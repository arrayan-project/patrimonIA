import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ProgresoService } from './progreso.service.js';
import { ReservaService } from './reserva.service.js';
import { errorConCodigo } from '../common/errores.js';
import type { DedicarCuentaAObjetivoDto, QuitarCuentaDeObjetivoDto } from './dto/cuenta-dedicada.dto.js';

/** M-5: las que pueden tener plata para una meta (las mismas de "Ahorrar"; no bienes ni deudas). */
const DEDICABLES = new Set(['LIQUIDEZ', 'RESERVA', 'INVERSION']);

export interface ResultadoCuentaDedicadaDTO {
  objetivoId: string;
  elementoId: string;
  /** Progreso de la meta después del comando. */
  progreso: number;
  /** Dedicar: reservas de esta meta sobre la cuenta que se liberaron (las cubre el valor). */
  reservasLiberadas: string[];
  /** Quitar con conservarComoApartado: la reserva fija creada. */
  reservaId: string | null;
}

/**
 * Bloque M (Docs/usabilidad/METAS_CUENTAS_S04.md) — "🏦 Esta cuenta es para
 * esta meta". Una meta puede tener varias cuentas dedicadas; su progreso suma
 * el valor actual de cada una (ProgresoService). Una cuenta, una sola meta.
 */
@Injectable()
export class CuentaDedicadaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly progreso: ProgresoService,
    private readonly reservas: ReservaService,
  ) {}

  /** DedicarCuentaAObjetivo. */
  async dedicar(actorId: string, dto: DedicarCuentaAObjetivoDto): Promise<ResultadoCuentaDedicadaDTO> {
    const objetivo = await this.#objetivoModificable(dto.objetivoId, actorId);
    if (objetivo.estado === 'CANCELADO') {
      throw errorConCodigo(ConflictException, 'OBJETIVO_CANCELADO', 'La meta está cancelada');
    }
    const el = await this.#cuentaPropia(dto.elementoId, actorId);
    if (!DEDICABLES.has(el.categoria_funcional)) {
      throw errorConCodigo(
        ConflictException,
        'CUENTA_NO_DEDICABLE',
        'Solo se dedican cuentas, ahorros o inversiones (no bienes ni deudas)',
      );
    }
    if (el.moneda !== objetivo.moneda) {
      throw errorConCodigo(ConflictException, 'MONEDA_DISTINTA', 'La cuenta debe estar en la moneda de la meta');
    }
    const ya = await this.prisma.objetivo_cuenta_dedicada.findUnique({ where: { elemento_id: el.id } });
    if (ya) {
      throw errorConCodigo(
        ConflictException,
        ya.objetivo_id === objetivo.id ? 'CUENTA_YA_ES_DE_LA_META' : 'CUENTA_DEDICADA_A_OTRA_META',
        ya.objetivo_id === objetivo.id ? 'La cuenta ya es de esta meta' : 'La cuenta ya es de otra meta',
        { objetivoId: ya.objetivo_id },
      );
    }
    // Lo apartado para otras metas o ahorros se libera antes (M-3).
    const activas = await this.prisma.reserva.findMany({
      where: { elemento_origen_id: el.id, estado: 'ACTIVA' },
      include: { asignacion: { select: { objetivo_financiero_id: true } } },
    });
    const deOtras = activas.filter((r) => r.asignacion.objetivo_financiero_id !== objetivo.id);
    if (deOtras.length > 0) {
      throw errorConCodigo(
        ConflictException,
        'CUENTA_CON_APARTADOS',
        'La cuenta tiene plata apartada para otra meta: libérala primero',
        { reservas: deOtras.map((r) => r.id) },
      );
    }
    // M-7: en una meta del hogar, el hogar tiene que ver el saldo de la cuenta.
    if (objetivo.hogar_id && !(await this.#hogarVeElSaldo(el.id, el.visibilidad))) {
      throw errorConCodigo(
        ConflictException,
        'CUENTA_SALDO_PRIVADO',
        'Para una meta del hogar, el hogar tiene que ver el saldo de la cuenta',
      );
    }
    const deEsta = activas.filter((r) => r.asignacion.objetivo_financiero_id === objetivo.id);

    return this.prisma.$transaction(async (tx) => {
      await tx.objetivo_cuenta_dedicada.create({ data: { objetivo_id: objetivo.id, elemento_id: el.id } });
      if (deEsta.length > 0) {
        await tx.reserva.updateMany({ where: { id: { in: deEsta.map((r) => r.id) } }, data: { estado: 'LIBERADA' } });
      }
      const entradaId = await this.auditoria.registrar(tx, {
        comando: 'DedicarCuentaAObjetivo',
        usuarioId: actorId,
        entidadTipo: 'OBJETIVO_FINANCIERO',
        entidadId: objetivo.id,
        entidadRelacionadaTipo: 'ELEMENTO_PATRIMONIAL',
        entidadRelacionadaId: el.id,
        valorPosterior: {
          elemento_id: el.id,
          valor_al_dedicar: Number(el.valor_vigente),
          reservas_liberadas: deEsta.map((r) => ({ id: r.id, monto: Number(r.monto) })),
        },
      });
      await this.progreso.recalcularYCompletar(tx, objetivo.id, actorId, entradaId);
      return {
        objetivoId: objetivo.id,
        elementoId: el.id,
        progreso: await this.progreso.progresoDeObjetivo(objetivo.id, tx),
        reservasLiberadas: deEsta.map((r) => r.id),
        reservaId: null,
      };
    });
  }

  /** QuitarCuentaDeObjetivo (dueño de la cuenta o quien puede modificar la meta). */
  async quitar(actorId: string, dto: QuitarCuentaDeObjetivoDto): Promise<ResultadoCuentaDedicadaDTO> {
    const fila = await this.prisma.objetivo_cuenta_dedicada.findUnique({
      where: { objetivo_id_elemento_id: { objetivo_id: dto.objetivoId, elemento_id: dto.elementoId } },
      include: { elemento_patrimonial: true, objetivo_financiero: true },
    });
    if (!fila) throw errorConCodigo(NotFoundException, 'CUENTA_NO_ES_DE_LA_META', 'La cuenta no es de esta meta');
    const esDuenaDeLaCuenta = !!(await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: dto.elementoId, usuario_id: actorId },
    }));
    if (!esDuenaDeLaCuenta) await this.#objetivoModificable(dto.objetivoId, actorId);
    const valor = Number(fila.elemento_patrimonial.valor_vigente);

    return this.prisma.$transaction(async (tx) => {
      await tx.objetivo_cuenta_dedicada.delete({
        where: { objetivo_id_elemento_id: { objetivo_id: dto.objetivoId, elemento_id: dto.elementoId } },
      });
      const entradaId = await this.auditoria.registrar(tx, {
        comando: 'QuitarCuentaDeObjetivo',
        usuarioId: actorId,
        entidadTipo: 'OBJETIVO_FINANCIERO',
        entidadId: dto.objetivoId,
        entidadRelacionadaTipo: 'ELEMENTO_PATRIMONIAL',
        entidadRelacionadaId: dto.elementoId,
        valorAnterior: { elemento_id: dto.elementoId, valor_al_quitar: valor },
        valorPosterior: { conservar_como_apartado: dto.conservarComoApartado },
      });
      let reservaId: string | null = null;
      if (dto.conservarComoApartado && valor > 0 && esDuenaDeLaCuenta) {
        // La parte de la meta de quien quita (la crea si no tiene), como "Ahorrar".
        const parte =
          (await tx.asignacion.findFirst({
            where: { objetivo_financiero_id: dto.objetivoId, usuario_id: actorId },
            orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
          })) ??
          (await tx.asignacion.create({
            data: { nombre: fila.objetivo_financiero.nombre, objetivo_financiero_id: dto.objetivoId, usuario_id: actorId },
          }));
        const r = await this.reservas.crearEnTx(
          tx,
          actorId,
          { asignacionId: parte.id, elementoOrigenId: dto.elementoId, monto: valor },
          { encadenadaDeId: entradaId },
        );
        reservaId = r.id;
      }
      return {
        objetivoId: dto.objetivoId,
        elementoId: dto.elementoId,
        progreso: await this.progreso.progresoDeObjetivo(dto.objetivoId, tx),
        reservasLiberadas: [],
        reservaId,
      };
    });
  }

  async #objetivoModificable(objetivoId: string, actorId: string) {
    const o = await this.prisma.objetivo_financiero.findUnique({ where: { id: objetivoId } });
    if (!o) throw errorConCodigo(NotFoundException, 'OBJETIVO_NO_ENCONTRADO', 'Objetivo no encontrado');
    if (o.usuario_id === actorId) return o;
    if (o.hogar_id) {
      const d = await this.prisma.objetivo_designado.findUnique({
        where: { objetivo_id_usuario_id: { objetivo_id: o.id, usuario_id: actorId } },
      });
      if (d) return o;
    }
    throw errorConCodigo(ForbiddenException, 'OBJETIVO_NO_MODIFICABLE', 'No puedes modificar este objetivo');
  }

  async #cuentaPropia(elementoId: string, actorId: string) {
    const el = await this.prisma.elemento_patrimonial.findUnique({ where: { id: elementoId } });
    if (!el || el.estado !== 'ACTIVO') {
      throw errorConCodigo(NotFoundException, 'ELEMENTO_NO_ENCONTRADO', 'Cuenta no encontrada');
    }
    const prop = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: elementoId, usuario_id: actorId },
    });
    if (!prop) throw errorConCodigo(ForbiddenException, 'CUENTA_AJENA', 'Solo puedes dedicar una cuenta tuya');
    return el;
  }

  /** M-7: el VALOR de la cuenta es visible para el hogar (nivel FAMILIAR, base o por tipo). */
  async #hogarVeElSaldo(elementoId: string, base: string): Promise<boolean> {
    const o = await this.prisma.elemento_visibilidad.findUnique({
      where: { elemento_id_tipo_info: { elemento_id: elementoId, tipo_info: 'VALOR' } },
    });
    return (o?.nivel ?? base) === 'FAMILIAR';
  }
}
