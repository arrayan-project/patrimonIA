import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type agrupacion_elemento as AgrupacionRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type {
  ActualizarAgrupacionDto,
  CrearAgrupacionDto,
  DefinirElementosAgrupacionDto,
  EliminarAgrupacionDto,
} from './dto/agrupacion.dto.js';

export interface AgrupacionDTO {
  id: string;
  nombre: string;
  color: string | null;
  orden: number;
  elementoIds: string[];
}

/**
 * Agrupaciones de elementos (GAPS.md G23): carpetas de visualización personales
 * para ordenar cuentas y activos. NO afectan la consolidación, la reconstrucción
 * ni el valor — solo la vista. Un elemento pertenece a lo sumo a una agrupación.
 * Configuración → historial solo en auditoría.
 */
@Injectable()
export class AgrupacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async crear(actorId: string, dto: CrearAgrupacionDto): Promise<AgrupacionDTO> {
    const nombre = dto.nombre.trim();
    const dup = await this.prisma.agrupacion_elemento.findFirst({
      where: { usuario_id: actorId, nombre },
    });
    if (dup) throw new ConflictException('Ya tienes una agrupación con ese nombre');

    const max = await this.prisma.agrupacion_elemento.aggregate({
      where: { usuario_id: actorId },
      _max: { orden: true },
    });

    const creada = await this.prisma.$transaction(async (tx) => {
      const a = await tx.agrupacion_elemento.create({
        data: {
          usuario_id: actorId,
          nombre,
          color: dto.color ?? null,
          orden: (max._max.orden ?? -1) + 1,
        },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CrearAgrupacion',
        usuarioId: actorId,
        entidadTipo: 'AGRUPACION_ELEMENTO',
        entidadId: a.id,
        valorPosterior: { nombre: a.nombre },
      });
      return a;
    });
    return { id: creada.id, nombre: creada.nombre, color: creada.color, orden: creada.orden, elementoIds: [] };
  }

  async actualizar(actorId: string, dto: ActualizarAgrupacionDto): Promise<AgrupacionDTO> {
    const a = await this.#cargar(dto.agrupacionId, actorId);
    const data: Prisma.agrupacion_elementoUncheckedUpdateInput = {};
    const posterior: Record<string, unknown> = {};

    if (dto.nombre !== undefined && dto.nombre.trim() !== a.nombre) {
      const nombre = dto.nombre.trim();
      const dup = await this.prisma.agrupacion_elemento.findFirst({
        where: { usuario_id: actorId, nombre, id: { not: a.id } },
      });
      if (dup) throw new ConflictException('Ya tienes una agrupación con ese nombre');
      data.nombre = nombre;
      posterior.nombre = nombre;
    }
    if (dto.color !== undefined) {
      data.color = dto.color;
      posterior.color = dto.color;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');

    await this.prisma.$transaction(async (tx) => {
      await tx.agrupacion_elemento.update({ where: { id: a.id }, data });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarAgrupacion',
        usuarioId: actorId,
        entidadTipo: 'AGRUPACION_ELEMENTO',
        entidadId: a.id,
        valorPosterior: posterior,
      });
    });
    return this.#toDTO(a.id, actorId);
  }

  async eliminar(actorId: string, dto: EliminarAgrupacionDto): Promise<{ ok: true }> {
    const a = await this.#cargar(dto.agrupacionId, actorId);
    await this.prisma.$transaction(async (tx) => {
      // agrupacion_miembro cae por ON DELETE CASCADE — los elementos quedan "sin agrupar"
      await tx.agrupacion_elemento.delete({ where: { id: a.id } });
      await this.auditoria.registrar(tx, {
        comando: 'EliminarAgrupacion',
        usuarioId: actorId,
        entidadTipo: 'AGRUPACION_ELEMENTO',
        entidadId: a.id,
        valorAnterior: { nombre: a.nombre },
      });
    });
    return { ok: true };
  }

  async definirElementos(
    actorId: string,
    dto: DefinirElementosAgrupacionDto,
  ): Promise<AgrupacionDTO> {
    const a = await this.#cargar(dto.agrupacionId, actorId);
    const ids = [...new Set(dto.elementoIds)];

    if (ids.length > 0) {
      const propios = await this.prisma.elemento_propietario.findMany({
        where: { elemento_id: { in: ids }, usuario_id: actorId },
        select: { elemento_id: true },
      });
      const okIds = new Set(propios.map((p) => p.elemento_id));
      if (ids.some((id) => !okIds.has(id))) {
        throw new ForbiddenException('Un elemento no es tuyo');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const previos = (
        await tx.agrupacion_miembro.findMany({
          where: { agrupacion_id: a.id },
          select: { elemento_id: true },
        })
      ).map((x) => x.elemento_id);
      await tx.agrupacion_miembro.deleteMany({ where: { agrupacion_id: a.id } });
      if (ids.length > 0) {
        // sacar estos elementos de cualquier otra agrupación (una carpeta por elemento)
        await tx.agrupacion_miembro.deleteMany({ where: { elemento_id: { in: ids } } });
        await tx.agrupacion_miembro.createMany({
          data: ids.map((elemento_id) => ({ elemento_id, agrupacion_id: a.id })),
        });
      }
      await this.auditoria.registrar(tx, {
        comando: 'DefinirElementosAgrupacion',
        usuarioId: actorId,
        entidadTipo: 'AGRUPACION_ELEMENTO',
        entidadId: a.id,
        valorAnterior: { elementos: previos },
        valorPosterior: { elementos: ids },
      });
    });
    return this.#toDTO(a.id, actorId);
  }

  async listar(actorId: string): Promise<AgrupacionDTO[]> {
    const filas = await this.prisma.agrupacion_elemento.findMany({
      where: { usuario_id: actorId },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: { agrupacion_miembro: { select: { elemento_id: true } } },
    });
    return filas.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      color: a.color,
      orden: a.orden,
      elementoIds: a.agrupacion_miembro.map((m) => m.elemento_id),
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async #cargar(agrupacionId: string, actorId: string): Promise<AgrupacionRow> {
    const a = await this.prisma.agrupacion_elemento.findUnique({ where: { id: agrupacionId } });
    if (!a) throw new NotFoundException('Agrupación no encontrada');
    if (a.usuario_id !== actorId) throw new ForbiddenException('La agrupación no es tuya');
    return a;
  }

  async #toDTO(agrupacionId: string, actorId: string): Promise<AgrupacionDTO> {
    return (await this.listar(actorId)).find((a) => a.id === agrupacionId)!;
  }
}
