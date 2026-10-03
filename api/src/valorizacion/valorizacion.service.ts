import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type valorizacion as ValorizacionRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { toValorizacionDTO, type ValorizacionDTO } from './valorizacion.dto.js';
import type { RegistrarValorizacionDto } from './dto/registrar-valorizacion.dto.js';
import type { AnularValorizacionDto } from './dto/anular-valorizacion.dto.js';
import type { CorregirValorizacionDto } from './dto/corregir-valorizacion.dto.js';
import { errorConCodigo } from '../common/errores.js';

@Injectable()
export class ValorizacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * AS #17 — RegistrarValorizacion.
   * Validaciones: el elemento admite valorización (`admite_valorizacion`,
   * independiente de la categoría) y está activo; el actor es propietario.
   * Orquestación: reemplazar `valor_vigente` (no acumula) · guardar el valor
   * anterior en el historial · generar impacto patrimonial = nuevo − anterior.
   * Auditoría: Creación — usuario, fecha, valor anterior, valor nuevo.
   */
  async registrarValorizacion(
    actorId: string,
    dto: RegistrarValorizacionDto,
  ): Promise<ValorizacionDTO> {
    const elemento = await this.cargarElementoValorizable(dto.elementoId, actorId);
    const valorAnterior = new Prisma.Decimal(elemento.valor_vigente);
    const valorNuevo = new Prisma.Decimal(dto.valorNuevo);
    if (valorNuevo.equals(valorAnterior)) {
      throw new BadRequestException('El valor nuevo es igual al vigente');
    }
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const delta = valorNuevo.minus(valorAnterior);

    const valorizacion = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.valorizacion.create({
        data: {
          elemento_id: elemento.id,
          valor_anterior: valorAnterior,
          valor_nuevo: valorNuevo,
          fecha,
          anulada: false,
        },
      });

      await tx.impacto_patrimonial.create({
        data: {
          elemento_id: elemento.id,
          monto: delta,
          origen_tipo: 'VALORIZACION',
          origen_id: creada.id,
          fecha,
        },
      });
      await tx.elemento_patrimonial.update({
        where: { id: elemento.id },
        data: { valor_vigente: valorNuevo },
      });

      await this.auditoria.registrar(tx, {
        comando: 'RegistrarValorizacion',
        usuarioId: actorId,
        entidadTipo: 'VALORIZACION',
        entidadId: creada.id,
        valorAnterior: { valor: valorAnterior.toNumber() },
        valorPosterior: { valor: valorNuevo.toNumber() },
        entidadRelacionadaTipo: 'ELEMENTO_PATRIMONIAL',
        entidadRelacionadaId: elemento.id,
      });

      return creada;
    });

    return toValorizacionDTO(valorizacion);
  }

  /**
   * AS #18 — AnularValorizacion. Cualquier valorización vigente de la cadena,
   * no solo la última (GAPS.md G11). Elimina sus impactos y su efecto se
   * re-encadena (ver `#propagar`): si hay una valorización posterior, esa fija
   * el valor desde su fecha y `valor_vigente` no cambia; si era la última,
   * `valor_vigente` se descuenta en su delta (conserva los movimientos
   * posteriores a ella, que volver a `valor_anterior` borraría).
   * Auditoría: Anulación — motivo, valorización anulada, re-encadenada.
   */
  async anularValorizacion(actorId: string, dto: AnularValorizacionDto): Promise<ValorizacionDTO> {
    const valorizacion = await this.cargarValorizacion(dto.valorizacionId, actorId);
    if (valorizacion.anulada) throw errorConCodigo(ConflictException, 'YA_ANULADO', 'La valorización ya está anulada');
    if (await this.tieneCorreccionViva(valorizacion.id)) {
      throw new ConflictException('La valorización tiene una corrección vigente — anúlala primero');
    }

    const anulada = await this.prisma.$transaction(async (tx) => {
      const siguiente = await this.#siguienteEnCadena(tx, valorizacion);
      // Delta efectivo = suma de sus impactos (incluye compensaciones que haya
      // absorbido de anulaciones/correcciones anteriores a ella).
      const { _sum } = await tx.impacto_patrimonial.aggregate({
        where: { origen_tipo: 'VALORIZACION', origen_id: valorizacion.id },
        _sum: { monto: true },
      });
      const delta = new Prisma.Decimal(_sum.monto ?? 0);
      await tx.impacto_patrimonial.deleteMany({
        where: { origen_tipo: 'VALORIZACION', origen_id: valorizacion.id },
      });
      await this.#propagar(tx, valorizacion.elemento_id, siguiente, delta.negated());
      const actualizada = await tx.valorizacion.update({
        where: { id: valorizacion.id },
        data: { anulada: true },
      });

      await this.auditoria.registrar(tx, {
        comando: 'AnularValorizacion',
        usuarioId: actorId,
        entidadTipo: 'VALORIZACION',
        entidadId: valorizacion.id,
        motivo: dto.motivo,
        valorAnterior: { anulada: false },
        valorPosterior: { anulada: true, ...(siguiente ? { reencadenada_id: siguiente.id } : {}) },
        ...(siguiente
          ? { entidadRelacionadaTipo: 'VALORIZACION', entidadRelacionadaId: siguiente.id }
          : {}),
      });

      return actualizada;
    });

    return toValorizacionDTO(anulada);
  }

  /**
   * AS #19 — CorregirValorizacion. Patrón de corrección, pero REEMPLAZANDO el
   * valor: se inserta una valorización compensatoria (valor_anterior = el
   * incorrecto, valor_nuevo = el correcto) enlazada a la original, con la misma
   * fecha. Vale para cualquier valorización vigente, no solo la última (G11):
   * la diferencia se re-encadena como en la anulación (`#propagar`).
   * Auditoría: Corrección — valorización original, compensatoria, motivo.
   */
  async corregirValorizacion(
    actorId: string,
    dto: CorregirValorizacionDto,
  ): Promise<ValorizacionDTO> {
    const original = await this.cargarValorizacion(dto.valorizacionId, actorId);
    if (original.anulada) throw errorConCodigo(ConflictException, 'CORREGIR_ANULADO', 'No se puede corregir una valorización anulada');
    if (await this.tieneCorreccionViva(original.id)) {
      throw new ConflictException('La valorización ya tiene una corrección — corrige esa última');
    }

    const valorIncorrecto = new Prisma.Decimal(original.valor_nuevo);
    const valorCorrecto = new Prisma.Decimal(dto.valorCorrecto);
    if (valorCorrecto.equals(valorIncorrecto)) {
      throw new BadRequestException('El valor corregido es igual al registrado');
    }
    const delta = valorCorrecto.minus(valorIncorrecto);

    const compensatoria = await this.prisma.$transaction(async (tx) => {
      // Antes de crear la compensatoria, que queda justo después de la original.
      const siguiente = await this.#siguienteEnCadena(tx, original);
      const creada = await tx.valorizacion.create({
        data: {
          elemento_id: original.elemento_id,
          valor_anterior: valorIncorrecto,
          valor_nuevo: valorCorrecto,
          fecha: original.fecha,
          correccion_de_id: original.id,
          anulada: false,
        },
      });

      await tx.impacto_patrimonial.create({
        data: {
          elemento_id: original.elemento_id,
          monto: delta,
          origen_tipo: 'VALORIZACION',
          origen_id: creada.id,
          fecha: original.fecha,
        },
      });
      await this.#propagar(tx, original.elemento_id, siguiente, delta);

      await this.auditoria.registrar(tx, {
        comando: 'CorregirValorizacion',
        usuarioId: actorId,
        entidadTipo: 'VALORIZACION',
        entidadId: original.id,
        motivo: dto.motivo,
        valorAnterior: { valor_nuevo: valorIncorrecto.toNumber() },
        valorPosterior: {
          valor_nuevo: valorCorrecto.toNumber(),
          ...(siguiente ? { reencadenada_id: siguiente.id } : {}),
        },
        entidadRelacionadaTipo: 'VALORIZACION',
        entidadRelacionadaId: creada.id,
      });

      return creada;
    });

    return toValorizacionDTO(compensatoria);
  }

  async listarPorElemento(elementoId: string, actorId: string): Promise<ValorizacionDTO[]> {
    await this.exigirPropietario(elementoId, actorId);
    const valorizaciones = await this.prisma.valorizacion.findMany({
      where: { elemento_id: elementoId },
      orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }],
    });
    return valorizaciones.map(toValorizacionDTO);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async cargarElementoValorizable(elementoId: string, actorId: string) {
    const elemento = await this.prisma.elemento_patrimonial.findUnique({ where: { id: elementoId } });
    if (!elemento) throw new NotFoundException('Elemento no encontrado');
    await this.exigirPropietario(elementoId, actorId);
    if (elemento.estado !== 'ACTIVO') throw new BadRequestException('El elemento no está activo');
    if (!elemento.admite_valorizacion) {
      throw new BadRequestException('El elemento no admite valorización');
    }
    return elemento;
  }

  private async cargarValorizacion(id: string, actorId: string): Promise<ValorizacionRow> {
    const valorizacion = await this.prisma.valorizacion.findUnique({ where: { id } });
    if (!valorizacion) throw new NotFoundException('Valorización no encontrada');
    await this.exigirPropietario(valorizacion.elemento_id, actorId);
    return valorizacion;
  }

  private async exigirPropietario(elementoId: string, actorId: string): Promise<void> {
    const prop = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: elementoId, usuario_id: actorId },
    });
    if (!prop) throw new ForbiddenException('No eres propietario de ese elemento');
  }

  /**
   * G11 — la valorización vigente que sigue a `v` en la cadena del elemento, o
   * null si `v` es la última. Orden: fecha, y cada corrección justo después de
   * su original (comparten fecha; sin esto, una corrección tardía quedaría
   * después de valorizaciones del mismo día registradas entre medio).
   */
  async #siguienteEnCadena(
    tx: Prisma.TransactionClient,
    v: ValorizacionRow,
  ): Promise<ValorizacionRow | null> {
    const todas = await tx.valorizacion.findMany({ where: { elemento_id: v.elemento_id } });
    const porId = new Map(todas.map((x) => [x.id, x]));
    const raiz = (x: ValorizacionRow): ValorizacionRow => {
      let r = x;
      while (r.correccion_de_id && porId.has(r.correccion_de_id)) r = porId.get(r.correccion_de_id)!;
      return r;
    };
    const clave = (x: ValorizacionRow) => {
      const r = raiz(x);
      return [r.fecha.getTime(), r.created_at.getTime(), x.created_at.getTime()];
    };
    const cadena = todas
      .filter((x) => !x.anulada)
      .sort((a, b) => {
        const [ka, kb] = [clave(a), clave(b)];
        return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
      });
    const i = cadena.findIndex((x) => x.id === v.id);
    return cadena[i + 1] ?? null;
  }

  /**
   * G11 — re-encadena un cambio de `ajuste` en el valor de una valorización que
   * no es necesariamente la última. La valorización es un reemplazo (stock):
   *  - si hay una `siguiente`, ella fija el valor desde su fecha → su impacto
   *    debe absorber el cambio (`−ajuste`). Como `valorizacion` es inmutable, se
   *    agrega un impacto compensatorio ligado a ella, y `valor_vigente` no cambia;
   *  - si no hay, el cambio llega hasta hoy → `valor_vigente += ajuste`.
   * El historial entre la valorización tocada y la siguiente queda recalculado.
   */
  async #propagar(
    tx: Prisma.TransactionClient,
    elementoId: string,
    siguiente: ValorizacionRow | null,
    ajuste: Prisma.Decimal,
  ): Promise<void> {
    if (ajuste.isZero()) return;
    if (siguiente) {
      await tx.impacto_patrimonial.create({
        data: {
          elemento_id: elementoId,
          monto: ajuste.negated(),
          origen_tipo: 'VALORIZACION',
          origen_id: siguiente.id,
          fecha: siguiente.fecha,
        },
      });
      return;
    }
    const el = await tx.elemento_patrimonial.findUniqueOrThrow({ where: { id: elementoId } });
    await tx.elemento_patrimonial.update({
      where: { id: elementoId },
      data: { valor_vigente: new Prisma.Decimal(el.valor_vigente).plus(ajuste) },
    });
  }

  private async tieneCorreccionViva(valorizacionId: string): Promise<boolean> {
    const corr = await this.prisma.valorizacion.findFirst({
      where: { correccion_de_id: valorizacionId, anulada: false },
    });
    return corr !== null;
  }
}
