import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ajuste_patrimonial as AjusteRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { derivarValorPendiente } from '../common/deuda.js';
import { toAjusteDTO, type AjustePatrimonialDTO } from './ajuste.dto.js';
import type { RegistrarAjusteDto } from './dto/registrar-ajuste.dto.js';
import type { AnularAjusteDto } from './dto/anular-ajuste.dto.js';
import type { CorregirAjusteDto } from './dto/corregir-ajuste.dto.js';
import { errorConCodigo } from '../common/errores.js';

/**
 * Ajuste Patrimonial: mecanismo de EXCEPCIÓN para conciliar el patrimonio
 * registrado con el real cuando no se puede reconstruir la causa exacta
 * (DDD Sección L). Motivo obligatorio siempre.
 */
@Injectable()
export class AjustePatrimonialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** AS #20 — RegistrarAjustePatrimonial. Auditoría: Creación — monto, elemento, motivo. */
  async registrarAjuste(actorId: string, dto: RegistrarAjusteDto): Promise<AjustePatrimonialDTO> {
    if (dto.monto === 0) throw new BadRequestException('El monto del ajuste no puede ser 0');
    const elemento = await this.cargarElemento(dto.elementoId, actorId);
    const monto = new Prisma.Decimal(dto.monto);
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

    const ajuste = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.ajuste_patrimonial.create({
        data: { elemento_id: elemento.id, monto, motivo: dto.motivo, fecha, anulado: false },
      });
      await tx.impacto_patrimonial.create({
        data: {
          elemento_id: elemento.id,
          monto,
          origen_tipo: 'AJUSTE_PATRIMONIAL',
          origen_id: creado.id,
          fecha,
        },
      });
      await tx.elemento_patrimonial.update({
        where: { id: elemento.id },
        data: { valor_vigente: new Prisma.Decimal(elemento.valor_vigente).plus(monto) },
      });
      await derivarValorPendiente(tx, elemento.id);
      await this.auditoria.registrar(tx, {
        comando: 'RegistrarAjustePatrimonial',
        usuarioId: actorId,
        entidadTipo: 'AJUSTE_PATRIMONIAL',
        entidadId: creado.id,
        motivo: dto.motivo,
        valorPosterior: { monto: dto.monto, elemento_id: elemento.id },
        entidadRelacionadaTipo: 'ELEMENTO_PATRIMONIAL',
        entidadRelacionadaId: elemento.id,
      });
      return creado;
    });

    return toAjusteDTO(ajuste);
  }

  /** AS #21 — AnularAjustePatrimonial. Revierte el efecto y elimina el impacto. */
  async anularAjuste(actorId: string, dto: AnularAjusteDto): Promise<AjustePatrimonialDTO> {
    const ajuste = await this.cargarAjuste(dto.ajusteId, actorId);
    if (ajuste.anulado) throw errorConCodigo(ConflictException, 'YA_ANULADO', 'El ajuste ya está anulado');
    if (await this.tieneCorreccionViva(ajuste.id)) {
      throw new ConflictException('El ajuste tiene una corrección vigente — anúlala primero');
    }

    const anulado = await this.prisma.$transaction(async (tx) => {
      const impactos = await tx.impacto_patrimonial.findMany({
        where: { origen_tipo: 'AJUSTE_PATRIMONIAL', origen_id: ajuste.id },
      });
      for (const i of impactos) {
        const el = await tx.elemento_patrimonial.findUniqueOrThrow({ where: { id: i.elemento_id } });
        await tx.elemento_patrimonial.update({
          where: { id: i.elemento_id },
          data: { valor_vigente: new Prisma.Decimal(el.valor_vigente).minus(i.monto) },
        });
        await derivarValorPendiente(tx, i.elemento_id);
      }
      await tx.impacto_patrimonial.deleteMany({
        where: { origen_tipo: 'AJUSTE_PATRIMONIAL', origen_id: ajuste.id },
      });
      const actualizado = await tx.ajuste_patrimonial.update({
        where: { id: ajuste.id },
        data: { anulado: true },
      });
      await this.auditoria.registrar(tx, {
        comando: 'AnularAjustePatrimonial',
        usuarioId: actorId,
        entidadTipo: 'AJUSTE_PATRIMONIAL',
        entidadId: ajuste.id,
        motivo: dto.motivo,
        valorAnterior: { anulado: false },
        valorPosterior: { anulado: true },
      });
      return actualizado;
    });

    return toAjusteDTO(anulado);
  }

  /**
   * AS #22 — CorregirAjustePatrimonial. Patrón de corrección compensando montos:
   * ajuste compensatorio con monto = nuevoMonto − montoOriginal, enlazado al
   * original (que queda intacto).
   */
  async corregirAjuste(actorId: string, dto: CorregirAjusteDto): Promise<AjustePatrimonialDTO> {
    const original = await this.cargarAjuste(dto.ajusteId, actorId);
    if (original.anulado) throw errorConCodigo(ConflictException, 'CORREGIR_ANULADO', 'No se puede corregir un ajuste anulado');
    if (await this.tieneCorreccionViva(original.id)) {
      throw new ConflictException('El ajuste ya tiene una corrección — corrige esa última');
    }
    const nuevoMonto = new Prisma.Decimal(dto.nuevoMonto);
    const delta = nuevoMonto.minus(original.monto);
    if (delta.isZero()) {
      throw new BadRequestException('El nuevo monto es igual al actual');
    }

    const compensatorio = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.ajuste_patrimonial.create({
        data: {
          elemento_id: original.elemento_id,
          monto: delta,
          motivo: dto.motivo,
          fecha: original.fecha,
          correccion_de_id: original.id,
          anulado: false,
        },
      });
      await tx.impacto_patrimonial.create({
        data: {
          elemento_id: original.elemento_id,
          monto: delta,
          origen_tipo: 'AJUSTE_PATRIMONIAL',
          origen_id: creado.id,
          fecha: original.fecha,
        },
      });
      const el = await tx.elemento_patrimonial.findUniqueOrThrow({
        where: { id: original.elemento_id },
      });
      await tx.elemento_patrimonial.update({
        where: { id: original.elemento_id },
        data: { valor_vigente: new Prisma.Decimal(el.valor_vigente).plus(delta) },
      });
      await derivarValorPendiente(tx, original.elemento_id);
      await this.auditoria.registrar(tx, {
        comando: 'CorregirAjustePatrimonial',
        usuarioId: actorId,
        entidadTipo: 'AJUSTE_PATRIMONIAL',
        entidadId: original.id,
        motivo: dto.motivo,
        valorAnterior: { monto: original.monto.toNumber() },
        valorPosterior: { monto: nuevoMonto.toNumber() },
        entidadRelacionadaTipo: 'AJUSTE_PATRIMONIAL',
        entidadRelacionadaId: creado.id,
      });
      return creado;
    });

    return toAjusteDTO(compensatorio);
  }

  async listarPorElemento(elementoId: string, actorId: string): Promise<AjustePatrimonialDTO[]> {
    await this.exigirPropietario(elementoId, actorId);
    const ajustes = await this.prisma.ajuste_patrimonial.findMany({
      where: { elemento_id: elementoId },
      orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }],
    });
    return ajustes.map(toAjusteDTO);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async cargarElemento(elementoId: string, actorId: string) {
    const elemento = await this.prisma.elemento_patrimonial.findUnique({ where: { id: elementoId } });
    if (!elemento) throw new NotFoundException('Elemento no encontrado');
    await this.exigirPropietario(elementoId, actorId);
    if (elemento.estado !== 'ACTIVO') throw new BadRequestException('El elemento no está activo');
    return elemento;
  }

  private async cargarAjuste(id: string, actorId: string): Promise<AjusteRow> {
    const ajuste = await this.prisma.ajuste_patrimonial.findUnique({ where: { id } });
    if (!ajuste) throw new NotFoundException('Ajuste no encontrado');
    await this.exigirPropietario(ajuste.elemento_id, actorId);
    return ajuste;
  }

  private async exigirPropietario(elementoId: string, actorId: string): Promise<void> {
    const prop = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: elementoId, usuario_id: actorId },
    });
    if (!prop) throw new ForbiddenException('No eres propietario de ese elemento');
  }

  private async tieneCorreccionViva(ajusteId: string): Promise<boolean> {
    const corr = await this.prisma.ajuste_patrimonial.findFirst({
      where: { correccion_de_id: ajusteId, anulado: false },
    });
    return corr !== null;
  }
}
