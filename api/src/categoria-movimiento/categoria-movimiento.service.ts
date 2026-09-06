import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type categoria_movimiento as CategoriaRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { CATEGORIAS_DEFAULT } from './categorias-default.js';
import type {
  ActualizarCategoriaMovimientoDto,
  ArchivarCategoriaMovimientoDto,
  CrearCategoriaMovimientoDto,
  ReordenarCategoriasMovimientoDto,
} from './dto/categoria-movimiento.dto.js';

export interface CategoriaMovimientoDTO {
  id: string;
  hogarId: string;
  nombre: string;
  tipoAplicable: string;
  color: string | null;
  icono: string | null;
  orden: number;
  estado: string;
  categoriaPadreId: string | null;
}

function toDTO(c: CategoriaRow): CategoriaMovimientoDTO {
  return {
    id: c.id,
    hogarId: c.hogar_id,
    nombre: c.nombre,
    tipoAplicable: c.tipo_aplicable,
    color: c.color,
    icono: c.icono,
    orden: c.orden,
    estado: c.estado,
    categoriaPadreId: c.categoria_padre_id,
  };
}

/**
 * Categorías de movimiento (GAPS.md G23): vocabulario del hogar para clasificar
 * ingresos y gastos. Lista plana; configuración, no hecho económico → historial
 * solo en auditoría.
 */
@Injectable()
export class CategoriaMovimientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Siembra el set inicial al crear el hogar. Se llama dentro de esa transacción. */
  async sembrarPorDefecto(tx: Prisma.TransactionClient, hogarId: string): Promise<void> {
    await tx.categoria_movimiento.createMany({
      data: CATEGORIAS_DEFAULT.map((c, i) => ({
        hogar_id: hogarId,
        nombre: c.nombre,
        tipo_aplicable: c.tipoAplicable,
        orden: i,
        estado: 'ACTIVA',
      })),
    });
  }

  async crear(
    actorId: string,
    dto: CrearCategoriaMovimientoDto,
  ): Promise<CategoriaMovimientoDTO> {
    await this.exigirMiembro(dto.hogarId, actorId);
    const dup = await this.prisma.categoria_movimiento.findFirst({
      where: { hogar_id: dto.hogarId, nombre: dto.nombre.trim() },
    });
    if (dup) throw new ConflictException('Ya existe una categoría con ese nombre en el hogar');

    const padreId = dto.categoriaPadreId ?? null;
    if (padreId) await this.#validarPadre(padreId, dto.hogarId);

    const max = await this.prisma.categoria_movimiento.aggregate({
      where: { hogar_id: dto.hogarId },
      _max: { orden: true },
    });

    const creada = await this.prisma.$transaction(async (tx) => {
      const c = await tx.categoria_movimiento.create({
        data: {
          hogar_id: dto.hogarId,
          nombre: dto.nombre.trim(),
          tipo_aplicable: dto.tipoAplicable,
          color: dto.color ?? null,
          icono: dto.icono ?? null,
          categoria_padre_id: padreId,
          orden: (max._max.orden ?? -1) + 1,
          estado: 'ACTIVA',
        },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CrearCategoriaMovimiento',
        usuarioId: actorId,
        entidadTipo: 'CATEGORIA_MOVIMIENTO',
        entidadId: c.id,
        valorPosterior: {
          nombre: c.nombre,
          tipo_aplicable: c.tipo_aplicable,
          ...(padreId ? { categoria_padre_id: padreId } : {}),
        },
        entidadRelacionadaTipo: 'HOGAR',
        entidadRelacionadaId: dto.hogarId,
      });
      return c;
    });
    return toDTO(creada);
  }

  async actualizar(
    actorId: string,
    dto: ActualizarCategoriaMovimientoDto,
  ): Promise<CategoriaMovimientoDTO> {
    const c = await this.#cargar(dto.categoriaId, actorId);
    const data: Prisma.categoria_movimientoUncheckedUpdateInput = {};
    const anterior: Record<string, unknown> = {};
    const posterior: Record<string, unknown> = {};

    if (dto.categoriaPadreId !== undefined) {
      const nuevoPadre = dto.categoriaPadreId ?? null;
      if (nuevoPadre !== c.categoria_padre_id) {
        if (nuevoPadre === c.id) throw new BadRequestException('Una categoría no puede ser su propio padre');
        const hijos = await this.prisma.categoria_movimiento.count({
          where: { categoria_padre_id: c.id },
        });
        if (nuevoPadre && hijos > 0) {
          throw new BadRequestException(
            'Esta categoría tiene subcategorías — no puede anidarse (máximo 2 niveles)',
          );
        }
        if (nuevoPadre) await this.#validarPadre(nuevoPadre, c.hogar_id);
        data.categoria_padre_id = nuevoPadre;
        anterior.categoria_padre_id = c.categoria_padre_id;
        posterior.categoria_padre_id = nuevoPadre;
      }
    }

    if (dto.nombre !== undefined && dto.nombre.trim() !== c.nombre) {
      const dup = await this.prisma.categoria_movimiento.findFirst({
        where: { hogar_id: c.hogar_id, nombre: dto.nombre.trim(), id: { not: c.id } },
      });
      if (dup) throw new ConflictException('Ya existe una categoría con ese nombre');
      data.nombre = dto.nombre.trim();
      anterior.nombre = c.nombre;
      posterior.nombre = dto.nombre.trim();
    }
    if (dto.tipoAplicable !== undefined && dto.tipoAplicable !== c.tipo_aplicable) {
      data.tipo_aplicable = dto.tipoAplicable;
      anterior.tipo_aplicable = c.tipo_aplicable;
      posterior.tipo_aplicable = dto.tipoAplicable;
    }
    if (dto.color !== undefined) {
      data.color = dto.color;
      posterior.color = dto.color;
    }
    if (dto.icono !== undefined) {
      data.icono = dto.icono;
      posterior.icono = dto.icono;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.categoria_movimiento.update({ where: { id: c.id }, data });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarCategoriaMovimiento',
        usuarioId: actorId,
        entidadTipo: 'CATEGORIA_MOVIMIENTO',
        entidadId: c.id,
        valorAnterior: anterior,
        valorPosterior: posterior,
      });
      return fila;
    });
    return toDTO(actualizada);
  }

  async archivar(
    actorId: string,
    dto: ArchivarCategoriaMovimientoDto,
  ): Promise<CategoriaMovimientoDTO> {
    const c = await this.#cargar(dto.categoriaId, actorId);
    if (c.estado === 'ARCHIVADA') throw new ConflictException('La categoría ya está archivada');
    const hijosActivos = await this.prisma.categoria_movimiento.count({
      where: { categoria_padre_id: c.id, estado: 'ACTIVA' },
    });
    if (hijosActivos > 0) {
      throw new ConflictException('Archiva primero sus subcategorías');
    }

    const archivada = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.categoria_movimiento.update({
        where: { id: c.id },
        data: { estado: 'ARCHIVADA' },
      });
      await this.auditoria.registrar(tx, {
        comando: 'ArchivarCategoriaMovimiento',
        usuarioId: actorId,
        entidadTipo: 'CATEGORIA_MOVIMIENTO',
        entidadId: c.id,
        valorAnterior: { estado: 'ACTIVA' },
        valorPosterior: { estado: 'ARCHIVADA' },
      });
      return fila;
    });
    return toDTO(archivada);
  }

  async reordenar(
    actorId: string,
    dto: ReordenarCategoriasMovimientoDto,
  ): Promise<CategoriaMovimientoDTO[]> {
    await this.exigirMiembro(dto.hogarId, actorId);
    const delHogar = await this.prisma.categoria_movimiento.findMany({
      where: { hogar_id: dto.hogarId },
      select: { id: true },
    });
    const ids = new Set(delHogar.map((x) => x.id));
    if (dto.orden.length !== ids.size || dto.orden.some((id) => !ids.has(id))) {
      throw new BadRequestException('El orden debe listar exactamente las categorías del hogar');
    }

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.orden.length; i++) {
        await tx.categoria_movimiento.update({ where: { id: dto.orden[i] }, data: { orden: i } });
      }
      await this.auditoria.registrar(tx, {
        comando: 'ReordenarCategoriasMovimiento',
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
    incluirArchivadas = false,
  ): Promise<CategoriaMovimientoDTO[]> {
    await this.exigirMiembro(hogarId, actorId);
    const filas = await this.prisma.categoria_movimiento.findMany({
      where: { hogar_id: hogarId, ...(incluirArchivadas ? {} : { estado: 'ACTIVA' }) },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
    return filas.map(toDTO);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** El padre debe existir, ser del mismo hogar, estar ACTIVA y ser raíz (2 niveles). */
  async #validarPadre(padreId: string, hogarId: string): Promise<void> {
    const padre = await this.prisma.categoria_movimiento.findUnique({ where: { id: padreId } });
    if (!padre || padre.hogar_id !== hogarId) {
      throw new BadRequestException('La categoría padre no pertenece al hogar');
    }
    if (padre.estado !== 'ACTIVA') {
      throw new BadRequestException('La categoría padre está archivada');
    }
    if (padre.categoria_padre_id) {
      throw new BadRequestException('Solo se permiten 2 niveles — el padre ya es una subcategoría');
    }
  }

  async #cargar(categoriaId: string, actorId: string): Promise<CategoriaRow> {
    const c = await this.prisma.categoria_movimiento.findUnique({ where: { id: categoriaId } });
    if (!c) throw new NotFoundException('Categoría no encontrada');
    await this.exigirMiembro(c.hogar_id, actorId);
    return c;
  }

  private async exigirMiembro(hogarId: string, actorId: string): Promise<void> {
    const m = await this.prisma.membresia.findFirst({
      where: { hogar_id: hogarId, usuario_id: actorId, estado: 'ACTIVA' },
    });
    if (!m) throw new ForbiddenException('No eres miembro activo de ese hogar');
  }
}
