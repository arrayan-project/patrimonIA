import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type tipo_elemento as TipoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { TIPOS_ELEMENTO_DEFAULT } from './tipos-elemento-default.js';
import type {
  ActualizarTipoElementoDto,
  ArchivarTipoElementoDto,
  CrearTipoElementoDto,
  ReordenarTiposElementoDto,
} from './dto/tipo-elemento.dto.js';

export interface TipoElementoDTO {
  id: string;
  hogarId: string;
  nombre: string;
  categoriaSugerida: string | null;
  orden: number;
  estado: string;
}

function toDTO(t: TipoRow): TipoElementoDTO {
  return {
    id: t.id,
    hogarId: t.hogar_id,
    nombre: t.nombre,
    categoriaSugerida: t.categoria_sugerida,
    orden: t.orden,
    estado: t.estado,
  };
}

/**
 * Catálogo de tipos de elemento patrimonial del hogar (migración 018). Mismo
 * patrón que `categoria_movimiento`: vocabulario compartido, configuración
 * (historial solo en auditoría), lo administra cualquier miembro ACTIVA.
 */
@Injectable()
export class TipoElementoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async sembrarPorDefecto(tx: Prisma.TransactionClient, hogarId: string): Promise<void> {
    await tx.tipo_elemento.createMany({
      data: TIPOS_ELEMENTO_DEFAULT.map((t, i) => ({
        hogar_id: hogarId,
        nombre: t.nombre,
        categoria_sugerida: t.categoriaSugerida,
        orden: i,
        estado: 'ACTIVA',
      })),
    });
  }

  async crear(actorId: string, dto: CrearTipoElementoDto): Promise<TipoElementoDTO> {
    await this.#exigirMiembro(dto.hogarId, actorId);
    const dup = await this.prisma.tipo_elemento.findFirst({
      where: { hogar_id: dto.hogarId, nombre: dto.nombre.trim() },
    });
    if (dup) throw new ConflictException('Ya existe un tipo con ese nombre en el hogar');
    const max = await this.prisma.tipo_elemento.aggregate({
      where: { hogar_id: dto.hogarId },
      _max: { orden: true },
    });

    const creado = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tipo_elemento.create({
        data: {
          hogar_id: dto.hogarId,
          nombre: dto.nombre.trim(),
          categoria_sugerida: dto.categoriaSugerida ?? null,
          orden: (max._max.orden ?? -1) + 1,
          estado: 'ACTIVA',
        },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CrearTipoElemento',
        usuarioId: actorId,
        entidadTipo: 'TIPO_ELEMENTO',
        entidadId: t.id,
        valorPosterior: { nombre: t.nombre, categoria_sugerida: t.categoria_sugerida },
        entidadRelacionadaTipo: 'HOGAR',
        entidadRelacionadaId: dto.hogarId,
      });
      return t;
    });
    return toDTO(creado);
  }

  async actualizar(actorId: string, dto: ActualizarTipoElementoDto): Promise<TipoElementoDTO> {
    const t = await this.#cargar(dto.tipoId, actorId);
    const data: Prisma.tipo_elementoUncheckedUpdateInput = {};
    const anterior: Record<string, unknown> = {};
    const posterior: Record<string, unknown> = {};

    if (dto.nombre !== undefined && dto.nombre.trim() !== t.nombre) {
      const dup = await this.prisma.tipo_elemento.findFirst({
        where: { hogar_id: t.hogar_id, nombre: dto.nombre.trim(), id: { not: t.id } },
      });
      if (dup) throw new ConflictException('Ya existe un tipo con ese nombre');
      data.nombre = dto.nombre.trim();
      anterior.nombre = t.nombre;
      posterior.nombre = dto.nombre.trim();
    }
    if (dto.categoriaSugerida !== undefined) {
      const nueva = dto.categoriaSugerida ?? null;
      if (nueva !== t.categoria_sugerida) {
        data.categoria_sugerida = nueva;
        anterior.categoria_sugerida = t.categoria_sugerida;
        posterior.categoria_sugerida = nueva;
      }
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.tipo_elemento.update({ where: { id: t.id }, data });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarTipoElemento',
        usuarioId: actorId,
        entidadTipo: 'TIPO_ELEMENTO',
        entidadId: t.id,
        valorAnterior: anterior,
        valorPosterior: posterior,
      });
      return fila;
    });
    return toDTO(actualizado);
  }

  async archivar(actorId: string, dto: ArchivarTipoElementoDto): Promise<TipoElementoDTO> {
    const t = await this.#cargar(dto.tipoId, actorId);
    if (t.estado === 'ARCHIVADA') throw new ConflictException('El tipo ya está archivado');
    const archivado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.tipo_elemento.update({
        where: { id: t.id },
        data: { estado: 'ARCHIVADA' },
      });
      await this.auditoria.registrar(tx, {
        comando: 'ArchivarTipoElemento',
        usuarioId: actorId,
        entidadTipo: 'TIPO_ELEMENTO',
        entidadId: t.id,
        valorAnterior: { estado: 'ACTIVA' },
        valorPosterior: { estado: 'ARCHIVADA' },
      });
      return fila;
    });
    return toDTO(archivado);
  }

  async reordenar(actorId: string, dto: ReordenarTiposElementoDto): Promise<TipoElementoDTO[]> {
    await this.#exigirMiembro(dto.hogarId, actorId);
    const delHogar = await this.prisma.tipo_elemento.findMany({
      where: { hogar_id: dto.hogarId },
      select: { id: true },
    });
    const ids = new Set(delHogar.map((x) => x.id));
    if (dto.orden.length !== ids.size || dto.orden.some((id) => !ids.has(id))) {
      throw new BadRequestException('El orden debe listar exactamente los tipos del hogar');
    }
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.orden.length; i++) {
        await tx.tipo_elemento.update({ where: { id: dto.orden[i] }, data: { orden: i } });
      }
      await this.auditoria.registrar(tx, {
        comando: 'ReordenarTiposElemento',
        usuarioId: actorId,
        entidadTipo: 'HOGAR',
        entidadId: dto.hogarId,
        valorPosterior: { orden: dto.orden },
      });
    });
    return this.listar(dto.hogarId, actorId, true);
  }

  async listar(
    hogarId: string,
    actorId: string,
    incluirArchivados = false,
  ): Promise<TipoElementoDTO[]> {
    await this.#exigirMiembro(hogarId, actorId);
    const filas = await this.prisma.tipo_elemento.findMany({
      where: { hogar_id: hogarId, ...(incluirArchivados ? {} : { estado: 'ACTIVA' }) },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
    return filas.map(toDTO);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async #cargar(tipoId: string, actorId: string): Promise<TipoRow> {
    const t = await this.prisma.tipo_elemento.findUnique({ where: { id: tipoId } });
    if (!t) throw new NotFoundException('Tipo de elemento no encontrado');
    await this.#exigirMiembro(t.hogar_id, actorId);
    return t;
  }

  async #exigirMiembro(hogarId: string, actorId: string): Promise<void> {
    const m = await this.prisma.membresia.findFirst({
      where: { hogar_id: hogarId, usuario_id: actorId, estado: 'ACTIVA' },
    });
    if (!m) throw new ForbiddenException('No eres miembro activo de ese hogar');
  }
}
