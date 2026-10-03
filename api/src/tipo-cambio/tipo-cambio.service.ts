import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type tipo_cambio as TipoCambioRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { RegistrarTipoCambioDto } from './dto/tipo-cambio.dto.js';
import { errorConCodigo } from '../common/errores.js';

export interface TipoCambioDTO {
  id: string;
  monedaOrigen: string;
  monedaDestino: string;
  tasa: number;
  fechaVigencia: string;
  fuente: string | null;
  createdAt: string;
}

function toDTO(t: TipoCambioRow): TipoCambioDTO {
  return {
    id: t.id,
    monedaOrigen: t.moneda_origen,
    monedaDestino: t.moneda_destino,
    tasa: Number(t.tasa),
    fechaVigencia: t.fecha_vigencia.toISOString().slice(0, 10),
    fuente: t.fuente,
    createdAt: t.created_at.toISOString(),
  };
}

@Injectable()
export class TipoCambioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** Comando nº 53 — RegistrarTipoCambio. Dato de referencia global, inmutable. */
  async registrar(actorId: string, dto: RegistrarTipoCambioDto): Promise<TipoCambioDTO> {
    const origen = dto.monedaOrigen.toUpperCase();
    const destino = dto.monedaDestino.toUpperCase();
    if (origen === destino) throw errorConCodigo(BadRequestException, 'MONEDAS_IGUALES', 'Origen y destino son la misma moneda');
    const fechaVigencia = dto.fechaVigencia
      ? new Date(`${dto.fechaVigencia.slice(0, 10)}T00:00:00.000Z`)
      : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');

    const yaExiste = await this.prisma.tipo_cambio.findFirst({
      where: { moneda_origen: origen, moneda_destino: destino, fecha_vigencia: fechaVigencia },
    });
    if (yaExiste) {
      throw new ConflictException(
        `Ya hay un tipo de cambio ${origen}→${destino} para esa fecha de vigencia`,
      );
    }

    const creado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.tipo_cambio.create({
        data: {
          moneda_origen: origen,
          moneda_destino: destino,
          tasa: new Prisma.Decimal(dto.tasa),
          fecha_vigencia: fechaVigencia,
          fuente: dto.fuente ?? null,
        },
      });
      await this.auditoria.registrar(tx, {
        comando: 'RegistrarTipoCambio',
        usuarioId: actorId,
        entidadTipo: 'TIPO_CAMBIO',
        entidadId: fila.id,
        valorPosterior: {
          moneda_origen: origen,
          moneda_destino: destino,
          tasa: dto.tasa,
          fecha_vigencia: fechaVigencia.toISOString().slice(0, 10),
          fuente: dto.fuente ?? null,
        },
      });
      return fila;
    });

    return toDTO(creado);
  }

  async listar(monedaOrigen?: string, monedaDestino?: string): Promise<TipoCambioDTO[]> {
    const filas = await this.prisma.tipo_cambio.findMany({
      where: {
        ...(monedaOrigen ? { moneda_origen: monedaOrigen.toUpperCase() } : {}),
        ...(monedaDestino ? { moneda_destino: monedaDestino.toUpperCase() } : {}),
      },
      orderBy: [{ fecha_vigencia: 'desc' }, { created_at: 'desc' }],
      take: 200,
    });
    return filas.map(toDTO);
  }
}
