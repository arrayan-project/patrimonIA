import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type etiqueta as EtiquetaRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type {
  ActualizarEtiquetaDto,
  CrearEtiquetaDto,
  EliminarEtiquetaDto,
  EtiquetarEventoDto,
} from './dto/etiqueta.dto.js';

export interface EtiquetaDTO {
  id: string;
  nombre: string;
  color: string | null;
}

const toDTO = (e: EtiquetaRow): EtiquetaDTO => ({ id: e.id, nombre: e.nombre, color: e.color });

/**
 * Etiquetas (GAPS.md G23): clasificación transversal, personal y acumulativa
 * (0..N por movimiento). Complementa a la categoría, no la sustituye. Anotación,
 * no hecho económico → historial solo en auditoría; se puede re-etiquetar sin
 * anular el movimiento.
 */
@Injectable()
export class EtiquetaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async crear(actorId: string, dto: CrearEtiquetaDto): Promise<EtiquetaDTO> {
    const nombre = dto.nombre.trim();
    const dup = await this.prisma.etiqueta.findFirst({ where: { usuario_id: actorId, nombre } });
    if (dup) throw new ConflictException('Ya tienes una etiqueta con ese nombre');

    const creada = await this.prisma.$transaction(async (tx) => {
      const e = await tx.etiqueta.create({
        data: { usuario_id: actorId, nombre, color: dto.color ?? null },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CrearEtiqueta',
        usuarioId: actorId,
        entidadTipo: 'ETIQUETA',
        entidadId: e.id,
        valorPosterior: { nombre: e.nombre },
      });
      return e;
    });
    return toDTO(creada);
  }

  async actualizar(actorId: string, dto: ActualizarEtiquetaDto): Promise<EtiquetaDTO> {
    const e = await this.#cargar(dto.etiquetaId, actorId);
    const data: Prisma.etiquetaUncheckedUpdateInput = {};
    const posterior: Record<string, unknown> = {};

    if (dto.nombre !== undefined && dto.nombre.trim() !== e.nombre) {
      const nombre = dto.nombre.trim();
      const dup = await this.prisma.etiqueta.findFirst({
        where: { usuario_id: actorId, nombre, id: { not: e.id } },
      });
      if (dup) throw new ConflictException('Ya tienes una etiqueta con ese nombre');
      data.nombre = nombre;
      posterior.nombre = nombre;
    }
    if (dto.color !== undefined) {
      data.color = dto.color;
      posterior.color = dto.color;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.etiqueta.update({ where: { id: e.id }, data });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarEtiqueta',
        usuarioId: actorId,
        entidadTipo: 'ETIQUETA',
        entidadId: e.id,
        valorPosterior: posterior,
      });
      return fila;
    });
    return toDTO(actualizada);
  }

  async eliminar(actorId: string, dto: EliminarEtiquetaDto): Promise<{ ok: true }> {
    const e = await this.#cargar(dto.etiquetaId, actorId);
    await this.prisma.$transaction(async (tx) => {
      // evento_etiqueta cae por ON DELETE CASCADE
      await tx.etiqueta.delete({ where: { id: e.id } });
      await this.auditoria.registrar(tx, {
        comando: 'EliminarEtiqueta',
        usuarioId: actorId,
        entidadTipo: 'ETIQUETA',
        entidadId: e.id,
        valorAnterior: { nombre: e.nombre },
      });
    });
    return { ok: true };
  }

  async listar(actorId: string): Promise<EtiquetaDTO[]> {
    const filas = await this.prisma.etiqueta.findMany({
      where: { usuario_id: actorId },
      orderBy: { nombre: 'asc' },
    });
    return filas.map(toDTO);
  }

  /**
   * EtiquetarEvento: reemplaza el conjunto de etiquetas de un movimiento propio.
   * Auditoría en la misma transacción.
   */
  async etiquetarEvento(actorId: string, dto: EtiquetarEventoDto): Promise<{ etiquetaIds: string[] }> {
    const evento = await this.prisma.evento_financiero.findUnique({ where: { id: dto.eventoId } });
    if (!evento) throw new NotFoundException('Movimiento no encontrado');
    if (evento.anulado) throw new BadRequestException('El movimiento está anulado');
    await this.#exigirEventoDelActor(dto.eventoId, actorId);

    const ids = [...new Set(dto.etiquetaIds)];
    await this.#exigirEtiquetasDelActor(ids, actorId);

    await this.prisma.$transaction(async (tx) => {
      const previas = (
        await tx.evento_etiqueta.findMany({
          where: { evento_id: dto.eventoId },
          select: { etiqueta_id: true },
        })
      ).map((x) => x.etiqueta_id);
      await tx.evento_etiqueta.deleteMany({ where: { evento_id: dto.eventoId } });
      if (ids.length > 0) {
        await tx.evento_etiqueta.createMany({
          data: ids.map((etiqueta_id) => ({ evento_id: dto.eventoId, etiqueta_id })),
        });
      }
      await this.auditoria.registrar(tx, {
        comando: 'EtiquetarEvento',
        usuarioId: actorId,
        entidadTipo: 'EVENTO_FINANCIERO',
        entidadId: dto.eventoId,
        valorAnterior: { etiquetas: previas },
        valorPosterior: { etiquetas: ids },
      });
    });
    return { etiquetaIds: ids };
  }

  /**
   * Adjunta etiquetas a un evento recién creado, dentro de su transacción.
   * Valida que todas sean del actor. Devuelve las aplicadas.
   */
  async adjuntarEnTx(
    tx: Prisma.TransactionClient,
    eventoId: string,
    etiquetaIds: string[],
    actorId: string,
  ): Promise<string[]> {
    const ids = [...new Set(etiquetaIds)];
    if (ids.length === 0) return [];
    const validas = await tx.etiqueta.findMany({
      where: { id: { in: ids }, usuario_id: actorId },
      select: { id: true },
    });
    if (validas.length !== ids.length) {
      throw new BadRequestException('Una etiqueta no existe o no es tuya');
    }
    await tx.evento_etiqueta.createMany({
      data: ids.map((etiqueta_id) => ({ evento_id: eventoId, etiqueta_id })),
    });
    return ids;
  }

  /** Mapa eventoId → etiquetaIds, para enriquecer los DTO de evento. */
  async deEventos(eventoIds: string[]): Promise<Map<string, string[]>> {
    const mapa = new Map<string, string[]>();
    if (eventoIds.length === 0) return mapa;
    const filas = await this.prisma.evento_etiqueta.findMany({
      where: { evento_id: { in: eventoIds } },
    });
    for (const f of filas) {
      mapa.set(f.evento_id, [...(mapa.get(f.evento_id) ?? []), f.etiqueta_id]);
    }
    return mapa;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async #cargar(etiquetaId: string, actorId: string): Promise<EtiquetaRow> {
    const e = await this.prisma.etiqueta.findUnique({ where: { id: etiquetaId } });
    if (!e) throw new NotFoundException('Etiqueta no encontrada');
    if (e.usuario_id !== actorId) throw new ForbiddenException('La etiqueta no es tuya');
    return e;
  }

  async #exigirEtiquetasDelActor(ids: string[], actorId: string): Promise<void> {
    if (ids.length === 0) return;
    const n = await this.prisma.etiqueta.count({
      where: { id: { in: ids }, usuario_id: actorId },
    });
    if (n !== ids.length) throw new BadRequestException('Una etiqueta no existe o no es tuya');
  }

  async #exigirEventoDelActor(eventoId: string, actorId: string): Promise<void> {
    const impactos = await this.prisma.impacto_patrimonial.findMany({
      where: { origen_tipo: 'EVENTO_FINANCIERO', origen_id: eventoId },
      select: { elemento_id: true },
    });
    const elementoIds = [...new Set(impactos.map((i) => i.elemento_id))];
    const propio = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: { in: elementoIds }, usuario_id: actorId },
    });
    if (!propio) throw new ForbiddenException('El movimiento no es tuyo');
  }
}
