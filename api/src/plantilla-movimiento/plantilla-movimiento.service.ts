import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type plantilla_movimiento as PlantillaRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { ElementoService } from '../elemento/elemento.service.js';
import type {
  ActualizarPlantillaMovimientoDto,
  CrearPlantillaMovimientoDto,
  EliminarPlantillaMovimientoDto,
  TipoPlantilla,
} from './dto/plantilla-movimiento.dto.js';

export interface PlantillaMovimientoDTO {
  id: string;
  nombre: string;
  tipo: string;
  monto: number | null;
  moneda: string | null;
  elementoOrigenId: string | null;
  elementoDestinoId: string | null;
  categoriaId: string | null;
  glosa: string | null;
  orden: number;
}

function toDTO(p: PlantillaRow): PlantillaMovimientoDTO {
  return {
    id: p.id,
    nombre: p.nombre,
    tipo: p.tipo,
    monto: p.monto === null ? null : Number(p.monto),
    moneda: p.moneda,
    elementoOrigenId: p.elemento_origen_id,
    elementoDestinoId: p.elemento_destino_id,
    categoriaId: p.categoria_id,
    glosa: p.glosa,
    orden: p.orden,
  };
}

/**
 * Plantillas de movimiento (GAPS.md G24): moldes personales y sin fecha para
 * registrar movimientos recurrentes en dos toques. Al aplicarlas, el cliente
 * llena `RegistrarEventoFinanciero` — la plantilla no genera nada por sí sola.
 * Configuración, no hecho económico → historial solo en auditoría.
 */
@Injectable()
export class PlantillaMovimientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly elementos: ElementoService,
  ) {}

  async crear(
    actorId: string,
    dto: CrearPlantillaMovimientoDto,
  ): Promise<PlantillaMovimientoDTO> {
    const nombre = dto.nombre.trim();
    const dup = await this.prisma.plantilla_movimiento.findFirst({
      where: { usuario_id: actorId, nombre },
    });
    if (dup) throw new ConflictException('Ya tienes una plantilla con ese nombre');

    await this.#validarCoherencia(actorId, dto.tipo, {
      elementoOrigenId: dto.elementoOrigenId,
      elementoDestinoId: dto.elementoDestinoId,
      categoriaId: dto.categoriaId,
    });

    const max = await this.prisma.plantilla_movimiento.aggregate({
      where: { usuario_id: actorId },
      _max: { orden: true },
    });

    const creada = await this.prisma.$transaction(async (tx) => {
      const p = await tx.plantilla_movimiento.create({
        data: {
          usuario_id: actorId,
          nombre,
          tipo: dto.tipo,
          // La app manda `null` cuando el monto queda vacío.
          monto: dto.monto == null ? null : new Prisma.Decimal(dto.monto),
          moneda: dto.moneda?.toUpperCase() ?? null,
          elemento_origen_id: dto.elementoOrigenId ?? null,
          elemento_destino_id: dto.elementoDestinoId ?? null,
          categoria_id: dto.categoriaId ?? null,
          glosa: dto.glosa?.trim() || null,
          orden: (max._max.orden ?? -1) + 1,
        },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CrearPlantillaMovimiento',
        usuarioId: actorId,
        entidadTipo: 'PLANTILLA_MOVIMIENTO',
        entidadId: p.id,
        valorPosterior: { nombre: p.nombre, tipo: p.tipo },
      });
      return p;
    });
    return toDTO(creada);
  }

  async actualizar(
    actorId: string,
    dto: ActualizarPlantillaMovimientoDto,
  ): Promise<PlantillaMovimientoDTO> {
    const p = await this.#cargar(dto.plantillaId, actorId);

    const data: Prisma.plantilla_movimientoUncheckedUpdateInput = {};
    const posterior: Record<string, unknown> = {};

    const tipoFinal: TipoPlantilla = (dto.tipo ?? p.tipo) as TipoPlantilla;

    if (dto.nombre !== undefined) {
      const nombre = dto.nombre.trim();
      if (nombre !== p.nombre) {
        const dup = await this.prisma.plantilla_movimiento.findFirst({
          where: { usuario_id: actorId, nombre, id: { not: p.id } },
        });
        if (dup) throw new ConflictException('Ya tienes una plantilla con ese nombre');
      }
      data.nombre = nombre;
      posterior.nombre = nombre;
    }
    if (dto.tipo !== undefined) {
      data.tipo = dto.tipo;
      posterior.tipo = dto.tipo;
    }
    if (dto.monto !== undefined) {
      data.monto = dto.monto === null ? null : new Prisma.Decimal(dto.monto);
      posterior.monto = dto.monto;
    }
    if (dto.moneda !== undefined) {
      data.moneda = dto.moneda === null ? null : dto.moneda.toUpperCase();
      posterior.moneda = data.moneda;
    }
    if (dto.glosa !== undefined) {
      data.glosa = dto.glosa === null ? null : dto.glosa.trim() || null;
      posterior.glosa = data.glosa;
    }

    // Los campos con FK se validan juntos contra el tipo final.
    const origen = dto.elementoOrigenId !== undefined ? dto.elementoOrigenId : p.elemento_origen_id;
    const destino =
      dto.elementoDestinoId !== undefined ? dto.elementoDestinoId : p.elemento_destino_id;
    const categoria = dto.categoriaId !== undefined ? dto.categoriaId : p.categoria_id;
    if (
      dto.tipo !== undefined ||
      dto.elementoOrigenId !== undefined ||
      dto.elementoDestinoId !== undefined ||
      dto.categoriaId !== undefined
    ) {
      await this.#validarCoherencia(actorId, tipoFinal, {
        elementoOrigenId: origen ?? undefined,
        elementoDestinoId: destino ?? undefined,
        categoriaId: categoria ?? undefined,
      });
    }
    if (dto.elementoOrigenId !== undefined) {
      data.elemento_origen_id = dto.elementoOrigenId;
      posterior.elemento_origen_id = dto.elementoOrigenId;
    }
    if (dto.elementoDestinoId !== undefined) {
      data.elemento_destino_id = dto.elementoDestinoId;
      posterior.elemento_destino_id = dto.elementoDestinoId;
    }
    if (dto.categoriaId !== undefined) {
      data.categoria_id = dto.categoriaId;
      posterior.categoria_id = dto.categoriaId;
    }

    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');

    const actualizada = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.plantilla_movimiento.update({ where: { id: p.id }, data });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarPlantillaMovimiento',
        usuarioId: actorId,
        entidadTipo: 'PLANTILLA_MOVIMIENTO',
        entidadId: p.id,
        valorPosterior: posterior,
      });
      return fila;
    });
    return toDTO(actualizada);
  }

  async eliminar(
    actorId: string,
    dto: EliminarPlantillaMovimientoDto,
  ): Promise<{ ok: true }> {
    const p = await this.#cargar(dto.plantillaId, actorId);
    await this.prisma.$transaction(async (tx) => {
      await tx.plantilla_movimiento.delete({ where: { id: p.id } });
      await this.auditoria.registrar(tx, {
        comando: 'EliminarPlantillaMovimiento',
        usuarioId: actorId,
        entidadTipo: 'PLANTILLA_MOVIMIENTO',
        entidadId: p.id,
        valorAnterior: { nombre: p.nombre, tipo: p.tipo },
      });
    });
    return { ok: true };
  }

  async listar(actorId: string): Promise<PlantillaMovimientoDTO[]> {
    const filas = await this.prisma.plantilla_movimiento.findMany({
      where: { usuario_id: actorId },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
    return filas.map(toDTO);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async #cargar(plantillaId: string, actorId: string): Promise<PlantillaRow> {
    const p = await this.prisma.plantilla_movimiento.findUnique({ where: { id: plantillaId } });
    if (!p) throw new NotFoundException('Plantilla no encontrada');
    if (p.usuario_id !== actorId) throw new ForbiddenException('La plantilla no es tuya');
    return p;
  }

  /** Valida los campos opcionales que sí vengan: propiedad de elementos, hogar y
   *  tipo de la categoría, y coherencia entre `tipo` y la categoría. El destino
   *  de una TRANSFERENCIA puede ser de otro miembro que deja transferirle (D-5, D-2). */
  async #validarCoherencia(
    actorId: string,
    tipo: TipoPlantilla,
    campos: { elementoOrigenId?: string; elementoDestinoId?: string; categoriaId?: string },
  ): Promise<void> {
    if (tipo === 'TRANSFERENCIA' && campos.elementoDestinoId) {
      const destino = await this.prisma.elemento_patrimonial.findUnique({
        where: { id: campos.elementoDestinoId },
      });
      if (!destino || !(await this.elementos.puedeRecibirTransferencia(destino, actorId))) {
        throw new ForbiddenException('No puedes transferir a esa cuenta');
      }
    }
    const propios = tipo === 'TRANSFERENCIA' ? [campos.elementoOrigenId] : [campos.elementoOrigenId, campos.elementoDestinoId];
    for (const id of propios) {
      if (!id) continue;
      const prop = await this.prisma.elemento_propietario.findFirst({
        where: { elemento_id: id, usuario_id: actorId },
      });
      if (!prop) throw new ForbiddenException('Un elemento de la plantilla no es tuyo');
    }

    if (campos.categoriaId) {
      if (tipo === 'TRANSFERENCIA') {
        throw new BadRequestException('Una transferencia no lleva categoría');
      }
      const cat = await this.prisma.categoria_movimiento.findUnique({
        where: { id: campos.categoriaId },
      });
      if (!cat) throw new BadRequestException('Categoría no válida');
      const miembro = await this.prisma.membresia.findFirst({
        where: { hogar_id: cat.hogar_id, usuario_id: actorId, estado: 'ACTIVA' },
      });
      if (!miembro) throw new ForbiddenException('La categoría no pertenece a un hogar tuyo');
      if (cat.tipo_aplicable !== 'AMBOS' && cat.tipo_aplicable !== tipo) {
        throw new BadRequestException(
          `La categoría "${cat.nombre}" no aplica a ${tipo.toLowerCase()}s`,
        );
      }
    }
  }
}
