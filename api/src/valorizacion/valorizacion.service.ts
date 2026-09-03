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
   * AS #18 — AnularValorizacion. Fase 4 solo permite anular la última
   * valorización vigente del elemento (la cadena debe ser recorrible en orden).
   * Revierte `valor_vigente` al valor anterior a ella y elimina su impacto.
   * Auditoría: Anulación — motivo, valorización anulada.
   */
  async anularValorizacion(actorId: string, dto: AnularValorizacionDto): Promise<ValorizacionDTO> {
    const valorizacion = await this.cargarValorizacion(dto.valorizacionId, actorId);
    if (valorizacion.anulada) throw new ConflictException('La valorización ya está anulada');
    if (await this.tieneCorreccionViva(valorizacion.id)) {
      throw new ConflictException('La valorización tiene una corrección vigente — anúlala primero');
    }
    await this.exigirUltimaVigente(valorizacion);

    const anulada = await this.prisma.$transaction(async (tx) => {
      await tx.impacto_patrimonial.deleteMany({
        where: { origen_tipo: 'VALORIZACION', origen_id: valorizacion.id },
      });
      await tx.elemento_patrimonial.update({
        where: { id: valorizacion.elemento_id },
        data: { valor_vigente: valorizacion.valor_anterior },
      });
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
        valorPosterior: { anulada: true },
      });

      return actualizada;
    });

    return toValorizacionDTO(anulada);
  }

  /**
   * AS #19 — CorregirValorizacion. Patrón de corrección, pero REEMPLAZANDO el
   * valor: se inserta una valorización compensatoria (valor_anterior = el
   * incorrecto, valor_nuevo = el correcto) enlazada a la original, y
   * `valor_vigente` pasa a ser el correcto — nunca se suma (stock, no flujo).
   * Auditoría: Corrección — valorización original, compensatoria, motivo.
   */
  async corregirValorizacion(
    actorId: string,
    dto: CorregirValorizacionDto,
  ): Promise<ValorizacionDTO> {
    const original = await this.cargarValorizacion(dto.valorizacionId, actorId);
    if (original.anulada) throw new ConflictException('No se puede corregir una valorización anulada');
    if (await this.tieneCorreccionViva(original.id)) {
      throw new ConflictException('La valorización ya tiene una corrección — corrige esa última');
    }
    await this.exigirUltimaVigente(original);

    const valorIncorrecto = new Prisma.Decimal(original.valor_nuevo);
    const valorCorrecto = new Prisma.Decimal(dto.valorCorrecto);
    if (valorCorrecto.equals(valorIncorrecto)) {
      throw new BadRequestException('El valor corregido es igual al registrado');
    }
    const delta = valorCorrecto.minus(valorIncorrecto);

    const compensatoria = await this.prisma.$transaction(async (tx) => {
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
        },
      });
      await tx.elemento_patrimonial.update({
        where: { id: original.elemento_id },
        data: { valor_vigente: valorCorrecto },
      });

      await this.auditoria.registrar(tx, {
        comando: 'CorregirValorizacion',
        usuarioId: actorId,
        entidadTipo: 'VALORIZACION',
        entidadId: original.id,
        motivo: dto.motivo,
        valorAnterior: { valor_nuevo: valorIncorrecto.toNumber() },
        valorPosterior: { valor_nuevo: valorCorrecto.toNumber() },
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

  /** La valorización debe ser la más reciente vigente de su elemento. */
  private async exigirUltimaVigente(valorizacion: ValorizacionRow): Promise<void> {
    const masReciente = await this.prisma.valorizacion.findFirst({
      where: { elemento_id: valorizacion.elemento_id, anulada: false },
      orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }],
    });
    if (masReciente?.id !== valorizacion.id) {
      throw new ConflictException(
        'Solo puede anularse o corregirse la última valorización vigente del elemento',
      );
    }
  }

  private async tieneCorreccionViva(valorizacionId: string): Promise<boolean> {
    const corr = await this.prisma.valorizacion.findFirst({
      where: { correccion_de_id: valorizacionId, anulada: false },
    });
    return corr !== null;
  }
}
