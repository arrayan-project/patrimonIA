import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type presupuesto as PresupuestoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import {
  esVigente,
  toPresupuestoDTO,
  type DesviacionObjetivoDTO,
  type DesviacionPresupuestariaDTO,
  type DesviacionRubroDTO,
  type PresupuestoDTO,
  type PresupuestoLineaAhorroDTO,
  type PresupuestoLineaDTO,
} from './presupuesto.dto.js';
import type {
  ActualizarPresupuestoDto,
  CambiarAlcancePresupuestoDto,
  CerrarPresupuestoDto,
  CrearPresupuestoDto,
  DefinirLineasAhorroPresupuestoDto,
  DefinirLineasPresupuestoDto,
  EliminarPresupuestoDto,
} from './dto/presupuesto.dto.js';
import { errorConCodigo } from '../common/errores.js';

const MESES_POR_INTERVALO: Record<string, number> = {
  MENSUAL: 1,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

/**
 * Presupuesto (Agregado K): expectativas financieras para un período o propósito.
 * NO modifica patrimonio, NO genera movimientos (DDD Sección K). Su único efecto
 * es servir la comparación presupuesto-vs-real (proyección desviacion_presupuestaria).
 */
@Injectable()
export class PresupuestoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /** AS #49 — CrearPresupuesto. Auditoría: Creación — usuario/hogar, tipo, período, montos esperados. */
  async crear(actorId: string, dto: CrearPresupuestoDto): Promise<PresupuestoDTO> {
    if (dto.tipo === 'FAMILIAR') {
      if (!dto.hogarId) throw new BadRequestException('Un presupuesto FAMILIAR requiere hogarId');
      await this.exigirMiembroActivo(dto.hogarId, actorId);
    } else if (dto.hogarId) {
      throw new BadRequestException('Un presupuesto INDIVIDUAL no lleva hogarId');
    }

    let intervalo: string | null = null;
    let fechaInicio: Date | null = null;
    let fechaFin: Date | null = null;
    let estado: string | null = null;

    if (dto.periodicidad === 'PERIODICO') {
      if (!dto.intervalo) {
        throw new BadRequestException('Un presupuesto PERIODICO requiere intervalo');
      }
      if (dto.fechaFin) {
        throw new BadRequestException('PERIODICO deriva fechaFin del intervalo — no la envíes');
      }
      intervalo = dto.intervalo;
      fechaInicio = dto.fechaInicio ? this.#fecha(dto.fechaInicio) : this.#inicioDeMes(new Date());
      fechaFin = this.#finDeIntervalo(fechaInicio, intervalo);
      // estado queda NULL: la vigencia de un PERIODICO es calendario (DATABASE_DESIGN §10).
    } else {
      if (dto.intervalo) {
        throw new BadRequestException('ESPECIFICO no lleva intervalo');
      }
      fechaInicio = dto.fechaInicio ? this.#fecha(dto.fechaInicio) : null;
      fechaFin = dto.fechaFin ? this.#fecha(dto.fechaFin) : null;
      if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
        throw new BadRequestException('fechaFin es anterior a fechaInicio');
      }
      estado = 'ACTIVO';
    }

    const presupuesto = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.presupuesto.create({
        data: {
          tipo: dto.tipo,
          periodicidad: dto.periodicidad,
          intervalo,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          ingresos_esperados: this.#dec(dto.ingresosEsperados),
          gastos_esperados: this.#dec(dto.gastosEsperados),
          ahorro_esperado: this.#dec(dto.ahorroEsperado),
          estado,
          usuario_id: actorId,
          hogar_id: dto.tipo === 'FAMILIAR' ? dto.hogarId! : null,
          moneda: dto.moneda?.trim().toUpperCase() || 'CLP',
        },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CrearPresupuesto',
        usuarioId: actorId,
        entidadTipo: 'PRESUPUESTO',
        entidadId: creado.id,
        valorPosterior: {
          tipo: creado.tipo,
          periodicidad: creado.periodicidad,
          intervalo,
          fecha_inicio: fechaInicio?.toISOString().slice(0, 10) ?? null,
          fecha_fin: fechaFin?.toISOString().slice(0, 10) ?? null,
          ingresos_esperados: dto.ingresosEsperados ?? null,
          gastos_esperados: dto.gastosEsperados ?? null,
          ahorro_esperado: dto.ahorroEsperado ?? null,
          ...(creado.hogar_id ? { hogar_id: creado.hogar_id } : {}),
        },
        ...(creado.hogar_id
          ? { entidadRelacionadaTipo: 'HOGAR', entidadRelacionadaId: creado.hogar_id }
          : {}),
      });
      return creado;
    });

    return toPresupuestoDTO(presupuesto);
  }

  /** AS #50 — ActualizarDatosPresupuesto. Auditoría: Modificación — campo(s), anterior/posterior. */
  async actualizar(actorId: string, dto: ActualizarPresupuestoDto): Promise<PresupuestoDTO> {
    const p = await this.#cargar(dto.presupuestoId, actorId);
    if (p.estado === 'CERRADO') {
      throw new ConflictException('El presupuesto está cerrado');
    }

    const data: Prisma.presupuestoUpdateInput = {};
    const anterior: Record<string, unknown> = {};
    const posterior: Record<string, unknown> = {};

    if (dto.intervalo !== undefined) {
      if (p.periodicidad !== 'PERIODICO') {
        throw new BadRequestException('Solo un presupuesto PERIODICO tiene intervalo');
      }
      if (dto.intervalo !== p.intervalo) {
        const base = p.fecha_inicio ?? this.#inicioDeMes(new Date());
        data.intervalo = dto.intervalo;
        data.fecha_inicio = base;
        data.fecha_fin = this.#finDeIntervalo(base, dto.intervalo);
        anterior.intervalo = p.intervalo;
        posterior.intervalo = dto.intervalo;
      }
    }
    if (dto.fechaInicio !== undefined && p.periodicidad === 'ESPECIFICO') {
      const f = this.#fecha(dto.fechaInicio);
      data.fecha_inicio = f;
      anterior.fecha_inicio = p.fecha_inicio?.toISOString().slice(0, 10) ?? null;
      posterior.fecha_inicio = dto.fechaInicio;
    }
    if (dto.fechaFin !== undefined && p.periodicidad === 'ESPECIFICO') {
      const f = this.#fecha(dto.fechaFin);
      data.fecha_fin = f;
      anterior.fecha_fin = p.fecha_fin?.toISOString().slice(0, 10) ?? null;
      posterior.fecha_fin = dto.fechaFin;
    }
    for (const [campo, col, valorActual] of [
      ['ingresosEsperados', 'ingresos_esperados', p.ingresos_esperados],
      ['gastosEsperados', 'gastos_esperados', p.gastos_esperados],
      ['ahorroEsperado', 'ahorro_esperado', p.ahorro_esperado],
    ] as const) {
      const nuevo = dto[campo];
      if (nuevo !== undefined && nuevo !== (valorActual === null ? null : Number(valorActual))) {
        (data as Record<string, unknown>)[col] = new Prisma.Decimal(nuevo);
        anterior[col] = valorActual === null ? null : Number(valorActual);
        posterior[col] = nuevo;
      }
    }

    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.presupuesto.update({ where: { id: p.id }, data });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarDatosPresupuesto',
        usuarioId: actorId,
        entidadTipo: 'PRESUPUESTO',
        entidadId: p.id,
        valorAnterior: anterior,
        valorPosterior: posterior,
      });
      return fila;
    });

    return toPresupuestoDTO(actualizado);
  }

  /**
   * CambiarAlcancePresupuesto (GAPS.md G36): "Solo tuyo" ↔ "Del hogar". Solo
   * quien lo creó; no si está cerrado. Si alguna línea deja de valer en el
   * nuevo alcance (una categoría de otro hogar, o ahorro hacia la meta de
   * alguien que queda fuera), se bloquea y se dice cuáles: no se borra nada.
   * Auditoría: Modificación — tipo y hogar anterior/posterior.
   */
  async cambiarAlcance(actorId: string, dto: CambiarAlcancePresupuestoDto): Promise<PresupuestoDTO> {
    const p = await this.#cargar(dto.presupuestoId, actorId);
    if (p.usuario_id !== actorId) {
      throw errorConCodigo(ForbiddenException, 'PRESUPUESTO_SOLO_CREADOR', 'Solo quien creó el presupuesto puede cambiar de quién es');
    }
    if (p.estado === 'CERRADO') throw new ConflictException('El presupuesto está cerrado');
    if (dto.tipo === p.tipo) {
      throw errorConCodigo(BadRequestException, 'PRESUPUESTO_MISMO_ALCANCE', 'El presupuesto ya es de ese tipo');
    }
    let hogarNuevo: string | null = null;
    if (dto.tipo === 'FAMILIAR') {
      if (!dto.hogarId) throw new BadRequestException('Un presupuesto FAMILIAR requiere hogarId');
      await this.exigirMiembroActivo(dto.hogarId, actorId);
      hogarNuevo = dto.hogarId;
    } else if (dto.hogarId) {
      throw new BadRequestException('Un presupuesto INDIVIDUAL no lleva hogarId');
    }

    // Las mismas reglas de alcance que definirLineas / definirLineasAhorro.
    const hogaresPermitidos = hogarNuevo
      ? [hogarNuevo]
      : (
          await this.prisma.membresia.findMany({
            where: { usuario_id: actorId, estado: 'ACTIVA' },
            select: { hogar_id: true },
          })
        ).map((m) => m.hogar_id);
    const usuariosEnAlcance = await this.#usuariosDelPresupuesto({ ...p, hogar_id: hogarNuevo }, actorId);
    const [lineas, lineasAhorro] = await Promise.all([
      this.prisma.presupuesto_linea.findMany({
        where: { presupuesto_id: p.id },
        include: { categoria_movimiento: true },
      }),
      this.prisma.presupuesto_linea_ahorro.findMany({
        where: { presupuesto_id: p.id },
        include: { objetivo_financiero: true },
      }),
    ]);
    const categorias = lineas
      .filter((l) => !hogaresPermitidos.includes(l.categoria_movimiento.hogar_id))
      .map((l) => l.categoria_movimiento.nombre);
    const metas = lineasAhorro
      .filter((l) => !usuariosEnAlcance.includes(l.objetivo_financiero.usuario_id ?? ''))
      .map((l) => l.objetivo_financiero.nombre);
    if (categorias.length > 0 || metas.length > 0) {
      throw errorConCodigo(
        BadRequestException,
        'PRESUPUESTO_FUERA_DE_ALCANCE',
        'Hay montos en categorías o metas que no son parte del nuevo alcance',
        { categorias, metas },
      );
    }

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.presupuesto.update({
        where: { id: p.id },
        data: { tipo: dto.tipo, hogar_id: hogarNuevo },
      });
      const hogarRelacionado = hogarNuevo ?? p.hogar_id;
      await this.auditoria.registrar(tx, {
        comando: 'CambiarAlcancePresupuesto',
        usuarioId: actorId,
        entidadTipo: 'PRESUPUESTO',
        entidadId: p.id,
        valorAnterior: { tipo: p.tipo, hogar_id: p.hogar_id },
        valorPosterior: { tipo: dto.tipo, hogar_id: hogarNuevo },
        ...(hogarRelacionado
          ? { entidadRelacionadaTipo: 'HOGAR', entidadRelacionadaId: hogarRelacionado }
          : {}),
      });
      return fila;
    });

    return toPresupuestoDTO(actualizado);
  }

  /** AS #51 — CerrarPresupuesto. Solo ESPECIFICO. Preserva la comparación para consulta futura. */
  async cerrar(actorId: string, dto: CerrarPresupuestoDto): Promise<PresupuestoDTO> {
    const p = await this.#cargar(dto.presupuestoId, actorId);
    if (p.periodicidad !== 'ESPECIFICO') {
      throw new BadRequestException(
        'Un presupuesto PERIODICO no se cierra — termina por calendario',
      );
    }
    if (p.estado === 'CERRADO') throw new ConflictException('El presupuesto ya está cerrado');

    const cerrado = await this.prisma.$transaction(async (tx) => {
      const fila = await tx.presupuesto.update({
        where: { id: p.id },
        data: { estado: 'CERRADO' },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CerrarPresupuesto',
        usuarioId: actorId,
        entidadTipo: 'PRESUPUESTO',
        entidadId: p.id,
        motivo: dto.motivo,
        valorAnterior: { estado: 'ACTIVO' },
        valorPosterior: { estado: 'CERRADO', fecha: new Date().toISOString().slice(0, 10) },
      });
      return fila;
    });

    return toPresupuestoDTO(cerrado);
  }

  /** AS #52 — EliminarPresupuesto. Borrado físico. Arrastra sus líneas por rubro. */
  async eliminar(actorId: string, dto: EliminarPresupuestoDto): Promise<{ ok: true }> {
    const p = await this.#cargar(dto.presupuestoId, actorId);
    await this.prisma.$transaction(async (tx) => {
      await tx.presupuesto_linea.deleteMany({ where: { presupuesto_id: p.id } });
      await tx.presupuesto.delete({ where: { id: p.id } });
      await this.auditoria.registrar(tx, {
        comando: 'EliminarPresupuesto',
        usuarioId: actorId,
        entidadTipo: 'PRESUPUESTO',
        entidadId: p.id,
        motivo: dto.motivo,
        valorAnterior: {
          tipo: p.tipo,
          periodicidad: p.periodicidad,
          intervalo: p.intervalo,
        },
      });
    });
    return { ok: true };
  }

  /**
   * DefinirLineasPresupuesto (GAPS.md G26): reemplaza el conjunto completo de
   * líneas por rubro del presupuesto. Un rubro con monto 0 se elimina.
   * Auditoría: Modificación — líneas anterior/posterior, en la misma transacción.
   */
  async definirLineas(
    actorId: string,
    dto: DefinirLineasPresupuestoDto,
  ): Promise<PresupuestoLineaDTO[]> {
    const p = await this.#cargar(dto.presupuestoId, actorId);
    if (p.estado === 'CERRADO') throw new ConflictException('El presupuesto está cerrado');

    const nuevas = dto.lineas.filter((l) => l.montoEsperado > 0);
    const ids = nuevas.map((l) => l.categoriaId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Hay una categoría repetida en las líneas');
    }

    // Categorías permitidas: FAMILIAR → las del hogar del presupuesto;
    // INDIVIDUAL → las de cualquier hogar donde el actor sea miembro ACTIVA.
    const hogaresPermitidos = p.hogar_id
      ? [p.hogar_id]
      : (
          await this.prisma.membresia.findMany({
            where: { usuario_id: actorId, estado: 'ACTIVA' },
            select: { hogar_id: true },
          })
        ).map((m) => m.hogar_id);

    if (ids.length > 0) {
      const validas = await this.prisma.categoria_movimiento.findMany({
        where: { id: { in: ids }, hogar_id: { in: hogaresPermitidos }, estado: 'ACTIVA' },
        select: { id: true },
      });
      const okIds = new Set(validas.map((c) => c.id));
      const invalida = ids.find((id) => !okIds.has(id));
      if (invalida) {
        throw new BadRequestException('Una categoría no está activa o no pertenece a tu hogar');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const previas = await tx.presupuesto_linea.findMany({
        where: { presupuesto_id: p.id },
        select: { categoria_id: true, monto_esperado: true },
      });
      await tx.presupuesto_linea.deleteMany({ where: { presupuesto_id: p.id } });
      if (nuevas.length > 0) {
        await tx.presupuesto_linea.createMany({
          data: nuevas.map((l) => ({
            presupuesto_id: p.id,
            categoria_id: l.categoriaId,
            monto_esperado: new Prisma.Decimal(l.montoEsperado),
          })),
        });
      }
      await this.auditoria.registrar(tx, {
        comando: 'DefinirLineasPresupuesto',
        usuarioId: actorId,
        entidadTipo: 'PRESUPUESTO',
        entidadId: p.id,
        valorAnterior: {
          lineas: previas.map((x) => ({
            categoria_id: x.categoria_id,
            monto_esperado: Number(x.monto_esperado),
          })),
        },
        valorPosterior: {
          lineas: nuevas.map((l) => ({
            categoria_id: l.categoriaId,
            monto_esperado: l.montoEsperado,
          })),
        },
        ...(p.hogar_id
          ? { entidadRelacionadaTipo: 'HOGAR', entidadRelacionadaId: p.hogar_id }
          : {}),
      });
    });

    return this.lineas(p.id, actorId);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async obtener(presupuestoId: string, actorId: string): Promise<PresupuestoDTO> {
    return toPresupuestoDTO(await this.#cargar(presupuestoId, actorId));
  }

  /** Líneas por rubro del presupuesto, con el nombre/color de cada categoría. */
  async lineas(presupuestoId: string, actorId: string): Promise<PresupuestoLineaDTO[]> {
    await this.#cargar(presupuestoId, actorId);
    const filas = await this.prisma.presupuesto_linea.findMany({
      where: { presupuesto_id: presupuestoId },
      include: { categoria_movimiento: true },
      orderBy: { categoria_movimiento: { orden: 'asc' } },
    });
    return filas.map((f) => ({
      id: f.id,
      presupuestoId: f.presupuesto_id,
      categoriaId: f.categoria_id,
      nombre: f.categoria_movimiento.nombre,
      color: f.categoria_movimiento.color,
      tipoAplicable: f.categoria_movimiento.tipo_aplicable,
      montoEsperado: Number(f.monto_esperado),
    }));
  }

  /** Usuarios cuyos hechos entran en el alcance del presupuesto (ver desviacion). */
  async #usuariosDelPresupuesto(p: PresupuestoRow, actorId: string): Promise<string[]> {
    if (!p.hogar_id) return [p.usuario_id ?? actorId];
    const miembros = await this.prisma.membresia.findMany({
      where: { hogar_id: p.hogar_id, estado: 'ACTIVA' },
      select: { usuario_id: true },
    });
    return miembros.map((m) => m.usuario_id);
  }

  /** GAPS.md P6 — reemplaza el conjunto de líneas de ahorro por objetivo. */
  async definirLineasAhorro(
    actorId: string,
    dto: DefinirLineasAhorroPresupuestoDto,
  ): Promise<PresupuestoLineaAhorroDTO[]> {
    const p = await this.#cargar(dto.presupuestoId, actorId);
    if (p.estado === 'CERRADO') throw new ConflictException('El presupuesto está cerrado');

    const nuevas = dto.lineas.filter((l) => l.montoEsperado > 0);
    const ids = nuevas.map((l) => l.objetivoId);
    if (new Set(ids).size !== ids.length) {
      throw errorConCodigo(BadRequestException, 'PRESUPUESTO_META_REPETIDA', 'Hay un objetivo repetido en las líneas');
    }

    if (ids.length > 0) {
      const enAlcance = await this.#usuariosDelPresupuesto(p, actorId);
      const validos = await this.prisma.objetivo_financiero.findMany({
        where: { id: { in: ids }, usuario_id: { in: enAlcance } },
        select: { id: true },
      });
      const okIds = new Set(validos.map((o) => o.id));
      if (ids.some((id) => !okIds.has(id))) {
        throw errorConCodigo(BadRequestException, 'PRESUPUESTO_META_INVALIDA', 'Un objetivo no existe o no está en el alcance del presupuesto');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const previas = await tx.presupuesto_linea_ahorro.findMany({
        where: { presupuesto_id: p.id },
        select: { objetivo_id: true, monto_esperado: true },
      });
      await tx.presupuesto_linea_ahorro.deleteMany({ where: { presupuesto_id: p.id } });
      if (nuevas.length > 0) {
        await tx.presupuesto_linea_ahorro.createMany({
          data: nuevas.map((l) => ({
            presupuesto_id: p.id,
            objetivo_id: l.objetivoId,
            monto_esperado: new Prisma.Decimal(l.montoEsperado),
          })),
        });
      }
      await this.auditoria.registrar(tx, {
        comando: 'DefinirLineasAhorroPresupuesto',
        usuarioId: actorId,
        entidadTipo: 'PRESUPUESTO',
        entidadId: p.id,
        valorAnterior: {
          lineas: previas.map((x) => ({
            objetivo_id: x.objetivo_id,
            monto_esperado: Number(x.monto_esperado),
          })),
        },
        valorPosterior: {
          lineas: nuevas.map((l) => ({ objetivo_id: l.objetivoId, monto_esperado: l.montoEsperado })),
        },
        ...(p.hogar_id ? { entidadRelacionadaTipo: 'HOGAR', entidadRelacionadaId: p.hogar_id } : {}),
      });
    });

    return this.lineasAhorro(p.id, actorId);
  }

  async lineasAhorro(
    presupuestoId: string,
    actorId: string,
  ): Promise<PresupuestoLineaAhorroDTO[]> {
    await this.#cargar(presupuestoId, actorId);
    const filas = await this.prisma.presupuesto_linea_ahorro.findMany({
      where: { presupuesto_id: presupuestoId },
      include: { objetivo_financiero: true },
    });
    return filas
      .map((f) => ({
        id: f.id,
        presupuestoId: f.presupuesto_id,
        objetivoId: f.objetivo_id,
        nombre: f.objetivo_financiero.nombre,
        montoEsperado: Number(f.monto_esperado),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  async listar(actorId: string, tipo?: string, soloVigentes?: boolean): Promise<PresupuestoDTO[]> {
    const hogares = await this.prisma.membresia.findMany({
      where: { usuario_id: actorId, estado: 'ACTIVA' },
      select: { hogar_id: true },
    });
    const filas = await this.prisma.presupuesto.findMany({
      where: {
        ...(tipo ? { tipo } : {}),
        OR: [
          { tipo: 'INDIVIDUAL', usuario_id: actorId },
          { tipo: 'FAMILIAR', hogar_id: { in: hogares.map((h) => h.hogar_id) } },
        ],
      },
      orderBy: { created_at: 'desc' },
    });
    const visibles = soloVigentes ? filas.filter((p) => esVigente(p)) : filas;
    return visibles.map(toPresupuestoDTO);
  }

  /**
   * Proyección desviacion_presupuestaria (DATABASE_DESIGN §12): compara los
   * montos esperados del presupuesto contra los reales agregados desde
   * evento_financiero en el período. Cálculo EN VIVO (Principio 1, GAPS.md G7).
   * Ver GAPS.md G16 para el alcance de "eventos del período" y la moneda.
   */
  async desviacion(presupuestoId: string, actorId: string): Promise<DesviacionPresupuestariaDTO> {
    const p = await this.#cargar(presupuestoId, actorId);

    const usuarioIds = p.hogar_id
      ? (
          await this.prisma.membresia.findMany({
            where: { hogar_id: p.hogar_id, estado: 'ACTIVA' },
            select: { usuario_id: true },
          })
        ).map((m) => m.usuario_id)
      : [p.usuario_id ?? actorId];

    const props = await this.prisma.elemento_propietario.findMany({
      where: { usuario_id: { in: usuarioIds } },
      select: { elemento_id: true },
    });
    const elementoIds = [...new Set(props.map((x) => x.elemento_id))];

    const real = { ingresos: 0, gastos: 0, ahorro: 0 };
    // real por categoría (categoria_id o null = sin clasificar) separado ingreso/gasto.
    const realPorCat = new Map<string | null, { ingresos: number; gastos: number }>();
    const sumarCat = (catId: string | null, tipo: 'ingresos' | 'gastos', monto: number) => {
      const cur = realPorCat.get(catId) ?? { ingresos: 0, gastos: 0 };
      cur[tipo] += monto;
      realPorCat.set(catId, cur);
    };
    if (elementoIds.length > 0) {
      const impactos = await this.prisma.impacto_patrimonial.findMany({
        where: { elemento_id: { in: elementoIds }, origen_tipo: 'EVENTO_FINANCIERO' },
        select: { origen_id: true },
      });
      const eventoIds = [...new Set(impactos.map((i) => i.origen_id))];
      const eventos = await this.prisma.evento_financiero.findMany({
        where: {
          id: { in: eventoIds },
          anulado: false,
          ...(p.fecha_inicio || p.fecha_fin
            ? {
                fecha: {
                  ...(p.fecha_inicio ? { gte: p.fecha_inicio } : {}),
                  ...(p.fecha_fin ? { lte: p.fecha_fin } : {}),
                },
              }
            : {}),
        },
      });
      for (const e of eventos) {
        // Sin tipos de cambio: se suman los montos tal cual, sin distinguir moneda (GAPS.md G16).
        // G35 (Juan, 2026-10-09): el saldo inicial cuenta como ingreso, igual que
        // en el resumen del mes (§G29), para que el Presupuesto y el Inicio cuadren.
        if (e.tipo === 'INGRESO' || e.tipo === 'SALDO_INICIAL') {
          real.ingresos += Number(e.monto);
          sumarCat(e.categoria_id, 'ingresos', Number(e.monto));
        } else if (e.tipo === 'GASTO') {
          real.gastos += Number(e.monto);
          sumarCat(e.categoria_id, 'gastos', Number(e.monto));
        }
        // TRANSFERENCIA / CONVERSION / PRESTAMO: no cuentan como
        // ingreso ni gasto del presupuesto del período.
      }
      real.ahorro = real.ingresos - real.gastos;
    }

    const porRubro = await this.#desviacionPorRubro(p.id, realPorCat);
    const porObjetivo = await this.#desviacionPorObjetivo(p);
    const sinCat = realPorCat.get(null) ?? { ingresos: 0, gastos: 0 };

    const esperado = {
      ingresos: Number(p.ingresos_esperados ?? 0),
      gastos: Number(p.gastos_esperados ?? 0),
      ahorro: Number(p.ahorro_esperado ?? 0),
    };

    return {
      presupuestoId: p.id,
      periodo: {
        desde: p.fecha_inicio?.toISOString().slice(0, 10) ?? null,
        hasta: p.fecha_fin?.toISOString().slice(0, 10) ?? null,
      },
      esperado,
      real,
      desviacion: {
        ingresos: real.ingresos - esperado.ingresos,
        gastos: real.gastos - esperado.gastos,
        ahorro: real.ahorro - esperado.ahorro,
      },
      porRubro,
      porObjetivo,
      sinClasificar: { ingresos: sinCat.ingresos, gastos: sinCat.gastos },
    };
  }

  /**
   * GAPS.md P6 — por cada línea de ahorro, compara el monto esperado contra el
   * ahorro real hacia el objetivo en el período: Σ reserva.monto (estado !=
   * LIBERADA) de las asignaciones del objetivo, creadas dentro del período.
   */
  async #desviacionPorObjetivo(p: PresupuestoRow): Promise<DesviacionObjetivoDTO[]> {
    const lineas = await this.prisma.presupuesto_linea_ahorro.findMany({
      where: { presupuesto_id: p.id },
      include: { objetivo_financiero: true },
    });
    if (lineas.length === 0) return [];

    const objetivoIds = lineas.map((l) => l.objetivo_id);
    const asignaciones = await this.prisma.asignacion.findMany({
      where: { objetivo_financiero_id: { in: objetivoIds } },
      select: { id: true, objetivo_financiero_id: true },
    });
    const asigPorObjetivo = new Map<string, string[]>();
    for (const a of asignaciones) {
      if (!a.objetivo_financiero_id) continue;
      const arr = asigPorObjetivo.get(a.objetivo_financiero_id) ?? [];
      arr.push(a.id);
      asigPorObjetivo.set(a.objetivo_financiero_id, arr);
    }

    const reservas = await this.prisma.reserva.findMany({
      where: {
        asignacion_id: { in: asignaciones.map((a) => a.id) },
        estado: { not: 'LIBERADA' },
        ...(p.fecha_inicio || p.fecha_fin
          ? {
              created_at: {
                ...(p.fecha_inicio ? { gte: p.fecha_inicio } : {}),
                ...(p.fecha_fin ? { lte: new Date(`${p.fecha_fin.toISOString().slice(0, 10)}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
      },
      select: { asignacion_id: true, monto: true },
    });
    const realPorAsig = new Map<string, number>();
    for (const r of reservas) {
      realPorAsig.set(r.asignacion_id, (realPorAsig.get(r.asignacion_id) ?? 0) + Number(r.monto));
    }

    return lineas
      .map((l) => {
        const esperado = Number(l.monto_esperado);
        const real = (asigPorObjetivo.get(l.objetivo_id) ?? []).reduce(
          (s, aid) => s + (realPorAsig.get(aid) ?? 0),
          0,
        );
        return {
          objetivoId: l.objetivo_id,
          nombre: l.objetivo_financiero.nombre,
          esperado,
          real,
          desviacion: real - esperado,
        };
      })
      .sort((a, b) => b.real - a.real);
  }

  /**
   * Desglose por rubro: una fila por línea del presupuesto (esperado vs. real de
   * esa categoría en el período) más los rubros con movimiento real pero sin
   * línea (esperado 0). Ordenado por real desc.
   */
  async #desviacionPorRubro(
    presupuestoId: string,
    realPorCat: Map<string | null, { ingresos: number; gastos: number }>,
  ): Promise<DesviacionRubroDTO[]> {
    const lineas = await this.prisma.presupuesto_linea.findMany({
      where: { presupuesto_id: presupuestoId },
      include: { categoria_movimiento: true },
    });

    // categorías que tienen movimiento real pero no aparecen como línea
    const conLinea = new Set(lineas.map((l) => l.categoria_id));
    const sueltas = [...realPorCat.keys()].filter(
      (k): k is string => k !== null && !conLinea.has(k),
    );
    const catsSueltas =
      sueltas.length > 0
        ? await this.prisma.categoria_movimiento.findMany({ where: { id: { in: sueltas } } })
        : [];

    const realDe = (catId: string, tipo: string) => {
      const r = realPorCat.get(catId) ?? { ingresos: 0, gastos: 0 };
      return tipo === 'INGRESO' ? r.ingresos : tipo === 'GASTO' ? r.gastos : r.ingresos + r.gastos;
    };

    const filas: DesviacionRubroDTO[] = [
      ...lineas.map((l) => {
        const c = l.categoria_movimiento;
        const esperado = Number(l.monto_esperado);
        const real = realDe(c.id, c.tipo_aplicable);
        return {
          categoriaId: c.id,
          nombre: c.nombre,
          color: c.color,
          tipoAplicable: c.tipo_aplicable,
          esperado,
          real,
          desviacion: real - esperado,
        };
      }),
      ...catsSueltas.map((c) => {
        const real = realDe(c.id, c.tipo_aplicable);
        return {
          categoriaId: c.id,
          nombre: c.nombre,
          color: c.color,
          tipoAplicable: c.tipo_aplicable,
          esperado: 0,
          real,
          desviacion: real,
        };
      }),
    ];

    return filas.sort((a, b) => b.real - a.real);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async #cargar(presupuestoId: string, actorId: string): Promise<PresupuestoRow> {
    const p = await this.prisma.presupuesto.findUnique({ where: { id: presupuestoId } });
    if (!p) throw new NotFoundException('Presupuesto no encontrado');
    if (p.hogar_id) {
      await this.exigirMiembroActivo(p.hogar_id, actorId);
    } else if (p.usuario_id !== actorId) {
      throw new ForbiddenException('El presupuesto no es tuyo');
    }
    return p;
  }

  private async exigirMiembroActivo(hogarId: string, actorId: string): Promise<void> {
    const m = await this.prisma.membresia.findFirst({
      where: { hogar_id: hogarId, usuario_id: actorId, estado: 'ACTIVA' },
    });
    if (!m) throw new ForbiddenException('No eres miembro activo de ese hogar');
  }

  #dec(n: number | undefined): Prisma.Decimal | null {
    return n === undefined ? null : new Prisma.Decimal(n);
  }

  /** Fecha calendario (sin hora) desde un ISO 'YYYY-MM-DD'. */
  #fecha(iso: string): Date {
    return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  }

  #inicioDeMes(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  /** Último día del intervalo que arranca en `inicio` (MENSUAL = 1 mes, etc.). */
  #finDeIntervalo(inicio: Date, intervalo: string): Date {
    const meses = MESES_POR_INTERVALO[intervalo] ?? 1;
    const fin = new Date(
      Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + meses, inicio.getUTCDate()),
    );
    fin.setUTCDate(fin.getUTCDate() - 1);
    return fin;
  }
}
