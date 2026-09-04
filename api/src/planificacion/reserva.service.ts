import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type reserva as ReservaRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ProgresoService } from './progreso.service.js';
import {
  toReservaDTO,
  type ReservaDeElementoDTO,
  type ReservaDTO,
} from './planificacion.dto.js';
import type {
  AjustarMontoReservaDto,
  CrearReservaDto,
  LiberarReservaDto,
} from './dto/reserva.dto.js';

@Injectable()
export class ReservaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly progreso: ProgresoService,
  ) {}

  /**
   * AS #27 — CrearReserva. Valida disponibilidad (la suma reservada no puede
   * exceder el valor libre del elemento origen) y recalcula el progreso del
   * objetivo asociado a la asignación.
   */
  async crear(actorId: string, dto: CrearReservaDto): Promise<ReservaDTO> {
    const asignacion = await this.#asignacionPropia(dto.asignacionId, actorId);
    await this.#exigirPropietarioElemento(dto.elementoOrigenId, actorId);

    const libre = await this.progreso.disponibilidad(dto.elementoOrigenId);
    if (dto.monto > libre + 1e-9) {
      throw new ConflictException(
        `El elemento solo tiene ${libre} disponible para reservar (pediste ${dto.monto})`,
      );
    }

    const reserva = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.reserva.create({
        data: {
          asignacion_id: asignacion.id,
          elemento_origen_id: dto.elementoOrigenId,
          monto: new Prisma.Decimal(dto.monto),
          estado: 'ACTIVA',
        },
      });
      const entradaId = await this.auditoria.registrar(tx, {
        comando: 'CrearReserva',
        usuarioId: actorId,
        entidadTipo: 'RESERVA',
        entidadId: creada.id,
        valorPosterior: {
          elemento_origen_id: dto.elementoOrigenId,
          monto: dto.monto,
          asignacion_id: asignacion.id,
        },
        entidadRelacionadaTipo: 'ASIGNACION',
        entidadRelacionadaId: asignacion.id,
      });
      if (asignacion.objetivo_financiero_id) {
        await this.progreso.recalcularYCompletar(
          tx,
          asignacion.objetivo_financiero_id,
          actorId,
          entradaId,
        );
      }
      return creada;
    });
    return toReservaDTO(reserva);
  }

  /** AS #28 — AjustarMontoReserva. Re-valida disponibilidad. */
  async ajustarMonto(actorId: string, dto: AjustarMontoReservaDto): Promise<ReservaDTO> {
    const reserva = await this.#cargar(dto.reservaId, actorId);
    if (reserva.estado !== 'ACTIVA') throw new ConflictException('La reserva no está activa');
    if (dto.nuevoMonto === Number(reserva.monto)) throw new BadRequestException('Sin cambios');

    const libre = await this.progreso.disponibilidad(
      reserva.elemento_origen_id,
      this.prisma,
      reserva.id,
    );
    if (dto.nuevoMonto > libre + 1e-9) {
      throw new ConflictException(`El elemento solo tiene ${libre} disponible (pediste ${dto.nuevoMonto})`);
    }

    const asignacion = await this.prisma.asignacion.findUniqueOrThrow({
      where: { id: reserva.asignacion_id },
    });

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const r = await tx.reserva.update({
        where: { id: reserva.id },
        data: { monto: new Prisma.Decimal(dto.nuevoMonto) },
      });
      const entradaId = await this.auditoria.registrar(tx, {
        comando: 'AjustarMontoReserva',
        usuarioId: actorId,
        entidadTipo: 'RESERVA',
        entidadId: reserva.id,
        valorAnterior: { monto: Number(reserva.monto) },
        valorPosterior: { monto: dto.nuevoMonto },
      });
      if (asignacion.objetivo_financiero_id) {
        await this.progreso.recalcularYCompletar(
          tx,
          asignacion.objetivo_financiero_id,
          actorId,
          entradaId,
        );
      }
      return r;
    });
    return toReservaDTO(actualizada);
  }

  /** AS #29 — LiberarReserva. Devuelve el monto al valor libre del elemento. */
  async liberar(actorId: string, dto: LiberarReservaDto): Promise<ReservaDTO> {
    const reserva = await this.#cargar(dto.reservaId, actorId);
    if (reserva.estado !== 'ACTIVA') throw new ConflictException('La reserva no está activa');
    const asignacion = await this.prisma.asignacion.findUniqueOrThrow({
      where: { id: reserva.asignacion_id },
    });

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const r = await tx.reserva.update({
        where: { id: reserva.id },
        data: { estado: 'LIBERADA' },
      });
      const entradaId = await this.auditoria.registrar(tx, {
        comando: 'LiberarReserva',
        usuarioId: actorId,
        entidadTipo: 'RESERVA',
        entidadId: reserva.id,
        motivo: dto.motivo,
        valorAnterior: { estado: 'ACTIVA', monto: Number(reserva.monto) },
        valorPosterior: { estado: 'LIBERADA' },
      });
      if (asignacion.objetivo_financiero_id) {
        await this.progreso.recalcularYCompletar(
          tx,
          asignacion.objetivo_financiero_id,
          actorId,
          entradaId,
        );
      }
      return r;
    });
    return toReservaDTO(actualizada);
  }

  async listarPorAsignacion(asignacionId: string, actorId: string): Promise<ReservaDTO[]> {
    await this.#asignacionPropia(asignacionId, actorId);
    const reservas = await this.prisma.reserva.findMany({
      where: { asignacion_id: asignacionId, estado: 'ACTIVA' },
      orderBy: { created_at: 'desc' },
    });
    return reservas.map(toReservaDTO);
  }

  /**
   * A2 — reservas ACTIVAS que financian un elemento, con la meta que las
   * compromete. Trazabilidad elemento → reserva (REQUISITES §F).
   */
  async listarPorElementoOrigen(
    elementoId: string,
    actorId: string,
  ): Promise<ReservaDeElementoDTO[]> {
    await this.#exigirPropietarioElemento(elementoId, actorId);
    const reservas = await this.prisma.reserva.findMany({
      where: { elemento_origen_id: elementoId, estado: 'ACTIVA' },
      include: { asignacion: { include: { objetivo_financiero: true } } },
      orderBy: { created_at: 'desc' },
    });
    return reservas.map((r) => ({
      id: r.id,
      monto: Number(r.monto),
      asignacionId: r.asignacion_id,
      asignacionNombre: r.asignacion.nombre,
      objetivoId: r.asignacion.objetivo_financiero_id,
      objetivoNombre: r.asignacion.objetivo_financiero?.nombre ?? null,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async #cargar(reservaId: string, actorId: string): Promise<ReservaRow> {
    const r = await this.prisma.reserva.findUnique({ where: { id: reservaId } });
    if (!r) throw new NotFoundException('Reserva no encontrada');
    await this.#asignacionPropia(r.asignacion_id, actorId);
    return r;
  }

  async #asignacionPropia(asignacionId: string, actorId: string) {
    const a = await this.prisma.asignacion.findUnique({ where: { id: asignacionId } });
    if (!a) throw new NotFoundException('Asignación no encontrada');
    if (a.usuario_id !== actorId) throw new ForbiddenException('La asignación no es tuya');
    return a;
  }

  async #exigirPropietarioElemento(elementoId: string, actorId: string): Promise<void> {
    const prop = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: elementoId, usuario_id: actorId },
    });
    if (!prop) throw new ForbiddenException('No eres propietario del elemento origen');
  }
}
