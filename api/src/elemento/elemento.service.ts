import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type elemento_patrimonial as ElementoRow } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import {
  toElementoDTO,
  toImpactoDTO,
  type ElementoPatrimonialDTO,
  type ImpactoPatrimonialDTO,
} from './elemento.dto.js';
import type { RegistrarElementoDto } from './dto/registrar-elemento.dto.js';
import type {
  ActualizarDatosElementoDto,
  CambiarParticipacionConsolidacionDto,
  CambiarPropiedadDto,
  CambiarVisibilidadDto,
  CorregirDatosElementoDto,
  DesactivarElementoDto,
  EliminarElementoDto,
  LlevarPendienteACeroDto,
  ReactivarElementoDto,
} from './dto/comandos-elemento.dto.js';

@Injectable()
export class ElementoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * AS #1 — RegistrarElementoPatrimonial.
   * Validaciones: ≥1 propietario · el hogar nunca es propietario (estructural:
   * elemento_propietario solo referencia usuario) · suma de % = 100 · cada %
   * en (0, 100]. Orquestación: valor_vigente = valor_inicial.
   * Auditoría: Creación — usuario, fecha, valor inicial, propietario(s), categoría.
   */
  async registrarElemento(
    actorId: string,
    dto: RegistrarElementoDto,
  ): Promise<ElementoPatrimonialDTO> {
    const propietarios = dto.propietarios ?? [{ usuarioId: actorId, porcentaje: 100 }];

    const suma = propietarios.reduce((acc, p) => acc + p.porcentaje, 0);
    if (Math.abs(suma - 100) > 0.001) {
      throw new BadRequestException(`La suma de porcentajes debe ser 100 (es ${suma})`);
    }
    if (propietarios.some((p) => p.porcentaje <= 0 || p.porcentaje > 100)) {
      throw new BadRequestException('Cada porcentaje debe estar en (0, 100]');
    }
    const idsUnicos = new Set(propietarios.map((p) => p.usuarioId));
    if (idsUnicos.size !== propietarios.length) {
      throw new BadRequestException('Un propietario aparece repetido');
    }
    if (!idsUnicos.has(actorId)) {
      // El actor debe ser uno de los propietarios que declara (no puede crear
      // un elemento 100% ajeno). Regla de la capa de aplicación — ver GAPS.md.
      throw new BadRequestException('Debes figurar entre los propietarios del elemento');
    }

    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: [...idsUnicos] }, estado: 'ACTIVO' },
    });
    if (usuarios.length !== idsUnicos.size) {
      throw new BadRequestException('Algún propietario no es un usuario activo');
    }

    // DEUDA/CREDITO: el atributo obligatorio es valor_pendiente; valor_vigente se
    // deriva con signo (DEUDA arrastra el patrimonio hacia abajo). Ver GAPS.md G17.
    const esDeudaOCredito = dto.categoriaFuncional === 'DEUDA' || dto.categoriaFuncional === 'CREDITO';
    let valorVigente: Prisma.Decimal;
    let valorPendiente: Prisma.Decimal | null = null;
    if (esDeudaOCredito) {
      if (dto.valorPendiente === undefined || dto.valorPendiente <= 0) {
        throw new BadRequestException('DEUDA/CREDITO requiere valorPendiente > 0');
      }
      if (dto.admiteValorizacion) {
        throw new BadRequestException('DEUDA/CREDITO no admite valorización');
      }
      valorPendiente = new Prisma.Decimal(dto.valorPendiente);
      valorVigente =
        dto.categoriaFuncional === 'DEUDA' ? valorPendiente.negated() : valorPendiente;
    } else {
      if (dto.valorPendiente !== undefined) {
        throw new BadRequestException('valorPendiente solo aplica a DEUDA/CREDITO');
      }
      valorVigente = new Prisma.Decimal(dto.valorInicial ?? 0);
    }

    const elemento = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.elemento_patrimonial.create({
        data: {
          nombre: dto.nombre,
          tipo: dto.tipo,
          categoria_funcional: dto.categoriaFuncional,
          ambito: dto.ambito ?? 'PERSONAL',
          valor_vigente: valorVigente,
          moneda: dto.moneda.toUpperCase(),
          participa_valor_liquido: dto.participaValorLiquido ?? false,
          participa_consolidacion: dto.participaConsolidacion ?? false,
          admite_valorizacion: dto.admiteValorizacion ?? false,
          visibilidad: dto.visibilidad ?? 'PRIVADA',
          estado: 'ACTIVO',
          valor_pendiente: valorPendiente,
        },
      });

      await tx.elemento_propietario.createMany({
        data: propietarios.map((p) => ({
          elemento_id: creado.id,
          usuario_id: p.usuarioId,
          porcentaje: new Prisma.Decimal(p.porcentaje),
        })),
      });

      await this.auditoria.registrar(tx, {
        comando: 'RegistrarElementoPatrimonial',
        usuarioId: actorId,
        entidadTipo: 'ELEMENTO_PATRIMONIAL',
        entidadId: creado.id,
        valorPosterior: {
          nombre: creado.nombre,
          categoria_funcional: creado.categoria_funcional,
          valor_inicial: esDeudaOCredito ? valorVigente.toNumber() : (dto.valorInicial ?? 0),
          ...(esDeudaOCredito ? { valor_pendiente: dto.valorPendiente } : {}),
          moneda: creado.moneda,
          propietarios: propietarios.map((p) => ({
            usuario_id: p.usuarioId,
            porcentaje: p.porcentaje,
          })),
        },
      });

      return creado;
    });

    return this.obtenerElemento(elemento.id, actorId);
  }

  // ── Comandos de estado y ciclo de vida ───────────────────────────────────

  /** AS #2 — ActualizarDatosElementoPatrimonial (campos no patrimoniales). */
  async actualizarDatos(actorId: string, dto: ActualizarDatosElementoDto) {
    return this.#editarCampos(actorId, dto, 'ActualizarDatosElementoPatrimonial');
  }

  /** AS #3 — CorregirDatosElementoPatrimonial (igual, marcado como corrección). */
  async corregirDatos(actorId: string, dto: CorregirDatosElementoDto) {
    return this.#editarCampos(actorId, dto, 'CorregirDatosElementoPatrimonial', dto.motivo);
  }

  async #editarCampos(
    actorId: string,
    dto: ActualizarDatosElementoDto,
    comando: string,
    motivo?: string,
  ): Promise<ElementoPatrimonialDTO> {
    const el = await this.#cargarActivo(dto.elementoId, actorId);
    const cambios: Prisma.elemento_patrimonialUpdateInput = {};
    const anterior: Record<string, unknown> = {};
    const posterior: Record<string, unknown> = {};
    if (dto.nombre !== undefined && dto.nombre !== el.nombre) {
      cambios.nombre = dto.nombre;
      anterior.nombre = el.nombre;
      posterior.nombre = dto.nombre;
    }
    if (dto.tipo !== undefined && dto.tipo !== el.tipo) {
      cambios.tipo = dto.tipo;
      anterior.tipo = el.tipo;
      posterior.tipo = dto.tipo;
    }
    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException('No hay cambios');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.elemento_patrimonial.update({ where: { id: el.id }, data: cambios });
      await this.auditoria.registrar(tx, {
        comando,
        usuarioId: actorId,
        entidadTipo: 'ELEMENTO_PATRIMONIAL',
        entidadId: el.id,
        valorAnterior: anterior,
        valorPosterior: posterior,
        motivo,
      });
    });
    return this.obtenerElemento(el.id, actorId);
  }

  /** AS #5 — CambiarVisibilidadElementoPatrimonial. Solo un propietario. */
  async cambiarVisibilidad(
    actorId: string,
    dto: CambiarVisibilidadDto,
  ): Promise<ElementoPatrimonialDTO> {
    const el = await this.#cargarConPropietario(dto.elementoId, actorId);
    if (el.visibilidad === dto.visibilidad) throw new BadRequestException('Sin cambios');
    await this.prisma.$transaction(async (tx) => {
      await tx.elemento_patrimonial.update({
        where: { id: el.id },
        data: { visibilidad: dto.visibilidad },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CambiarVisibilidadElementoPatrimonial',
        usuarioId: actorId,
        entidadTipo: 'ELEMENTO_PATRIMONIAL',
        entidadId: el.id,
        valorAnterior: { visibilidad: el.visibilidad },
        valorPosterior: { visibilidad: dto.visibilidad },
      });
    });
    return this.obtenerElemento(el.id, actorId);
  }

  /** AS #6 — CambiarParticipacionEnConsolidacion. */
  async cambiarParticipacionConsolidacion(
    actorId: string,
    dto: CambiarParticipacionConsolidacionDto,
  ): Promise<ElementoPatrimonialDTO> {
    const el = await this.#cargarConPropietario(dto.elementoId, actorId);
    if (el.participa_consolidacion === dto.participa) throw new BadRequestException('Sin cambios');
    await this.prisma.$transaction(async (tx) => {
      await tx.elemento_patrimonial.update({
        where: { id: el.id },
        data: { participa_consolidacion: dto.participa },
      });
      await this.auditoria.registrar(tx, {
        comando: 'CambiarParticipacionEnConsolidacion',
        usuarioId: actorId,
        entidadTipo: 'ELEMENTO_PATRIMONIAL',
        entidadId: el.id,
        valorAnterior: { participa_consolidacion: el.participa_consolidacion },
        valorPosterior: { participa_consolidacion: dto.participa },
      });
    });
    return this.obtenerElemento(el.id, actorId);
  }

  /** AS #7 — DesactivarElementoPatrimonial (eliminación lógica). */
  async desactivar(actorId: string, dto: DesactivarElementoDto): Promise<ElementoPatrimonialDTO> {
    const el = await this.#cargarConPropietario(dto.elementoId, actorId);
    if (el.estado !== 'ACTIVO') throw new ConflictException('El elemento no está activo');
    await this.prisma.$transaction(async (tx) => {
      await tx.elemento_patrimonial.update({ where: { id: el.id }, data: { estado: 'INACTIVO' } });
      await this.auditoria.registrar(tx, {
        comando: 'DesactivarElementoPatrimonial',
        usuarioId: actorId,
        entidadTipo: 'ELEMENTO_PATRIMONIAL',
        entidadId: el.id,
        valorAnterior: { estado: 'ACTIVO' },
        valorPosterior: { estado: 'INACTIVO' },
        motivo: dto.motivo,
      });
    });
    return this.obtenerElemento(el.id, actorId);
  }

  /** AS #8 — ReactivarElementoPatrimonial (misma entidad, historial intacto). */
  async reactivar(actorId: string, dto: ReactivarElementoDto): Promise<ElementoPatrimonialDTO> {
    const el = await this.#cargarConPropietario(dto.elementoId, actorId);
    if (el.estado !== 'INACTIVO') throw new ConflictException('El elemento no está inactivo');
    await this.prisma.$transaction(async (tx) => {
      await tx.elemento_patrimonial.update({ where: { id: el.id }, data: { estado: 'ACTIVO' } });
      await this.auditoria.registrar(tx, {
        comando: 'ReactivarElementoPatrimonial',
        usuarioId: actorId,
        entidadTipo: 'ELEMENTO_PATRIMONIAL',
        entidadId: el.id,
        valorAnterior: { estado: 'INACTIVO' },
        valorPosterior: { estado: 'ACTIVO' },
        motivo: dto.motivo,
      });
    });
    return this.obtenerElemento(el.id, actorId);
  }

  /**
   * AS #9 — EliminarElementoPatrimonial (físico, excepcional). Solo si no tiene
   * impactos patrimoniales reales — si los tiene, el caso correcto es Desactivar.
   */
  async eliminar(actorId: string, dto: EliminarElementoDto): Promise<{ ok: true }> {
    const el = await this.#cargarConPropietario(dto.elementoId, actorId);
    const impactos = await this.prisma.impacto_patrimonial.count({
      where: { elemento_id: el.id },
    });
    if (impactos > 0) {
      throw new ConflictException(
        'El elemento tiene impactos patrimoniales — usa DesactivarElementoPatrimonial',
      );
    }
    const reservas = await this.prisma.reserva.count({ where: { elemento_origen_id: el.id } });
    if (reservas > 0) throw new ConflictException('El elemento financia reservas activas');

    await this.prisma.$transaction(async (tx) => {
      await tx.elemento_propietario.deleteMany({ where: { elemento_id: el.id } });
      await tx.elemento_patrimonial.delete({ where: { id: el.id } });
      await this.auditoria.registrar(tx, {
        comando: 'EliminarElementoPatrimonial',
        usuarioId: actorId,
        entidadTipo: 'ELEMENTO_PATRIMONIAL',
        entidadId: el.id,
        motivo: dto.justificacion,
        valorAnterior: { nombre: el.nombre },
      });
    });
    return { ok: true };
  }

  /** AS #4 — CambiarPropiedadElementoPatrimonial. ≥1 propietario, suma % = 100. */
  async cambiarPropiedad(
    actorId: string,
    dto: CambiarPropiedadDto,
  ): Promise<ElementoPatrimonialDTO> {
    const el = await this.#cargarConPropietario(dto.elementoId, actorId);
    const suma = dto.propietarios.reduce((a, p) => a + p.porcentaje, 0);
    if (Math.abs(suma - 100) > 0.001) {
      throw new BadRequestException(`La suma de porcentajes debe ser 100 (es ${suma})`);
    }
    if (dto.propietarios.some((p) => p.porcentaje <= 0 || p.porcentaje > 100)) {
      throw new BadRequestException('Cada porcentaje debe estar en (0, 100]');
    }
    const ids = new Set(dto.propietarios.map((p) => p.usuarioId));
    if (ids.size !== dto.propietarios.length) throw new BadRequestException('Propietario repetido');
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: [...ids] }, estado: 'ACTIVO' },
    });
    if (usuarios.length !== ids.size) throw new BadRequestException('Algún propietario no es válido');

    const anteriores = await this.prisma.elemento_propietario.findMany({
      where: { elemento_id: el.id },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.elemento_propietario.deleteMany({ where: { elemento_id: el.id } });
      await tx.elemento_propietario.createMany({
        data: dto.propietarios.map((p) => ({
          elemento_id: el.id,
          usuario_id: p.usuarioId,
          porcentaje: new Prisma.Decimal(p.porcentaje),
        })),
      });
      await this.auditoria.registrar(tx, {
        comando: 'CambiarPropiedadElementoPatrimonial',
        usuarioId: actorId,
        entidadTipo: 'ELEMENTO_PATRIMONIAL',
        entidadId: el.id,
        valorAnterior: {
          propietarios: anteriores.map((p) => ({
            usuario_id: p.usuario_id,
            porcentaje: Number(p.porcentaje),
          })),
        },
        valorPosterior: {
          propietarios: dto.propietarios.map((p) => ({
            usuario_id: p.usuarioId,
            porcentaje: p.porcentaje,
          })),
        },
      });
    });
    return this.obtenerElemento(el.id, actorId);
  }

  /**
   * AS #47 — CondonarDeuda. Decisión activa del acreedor de perdonar el saldo.
   * Genera un impacto que lleva el valor pendiente (y el valor_vigente) a cero;
   * el elemento se conserva para efectos históricos (DDD Sección T).
   */
  async condonarDeuda(actorId: string, dto: LlevarPendienteACeroDto): Promise<ElementoPatrimonialDTO> {
    return this.#llevarPendienteACero(actorId, dto, 'CondonarDeuda', 'DEUDA', 'CONDONACION');
  }

  /**
   * AS #48 — DeclararIncobrable. Reconocimiento de que un crédito no se recuperará.
   * Mismo efecto mecánico que CondonarDeuda pero comando separado (DDD Sección T:
   * pueden divergir en efectos legales/contables).
   */
  async declararIncobrable(
    actorId: string,
    dto: LlevarPendienteACeroDto,
  ): Promise<ElementoPatrimonialDTO> {
    return this.#llevarPendienteACero(
      actorId,
      dto,
      'DeclararIncobrable',
      'CREDITO',
      'DECLARACION_INCOBRABLE',
    );
  }

  async #llevarPendienteACero(
    actorId: string,
    dto: LlevarPendienteACeroDto,
    comando: string,
    categoriaEsperada: 'DEUDA' | 'CREDITO',
    origenTipo: string,
  ): Promise<ElementoPatrimonialDTO> {
    const el = await this.#cargarConPropietario(dto.elementoId, actorId);
    if (el.estado !== 'ACTIVO') throw new ConflictException('El elemento no está activo');
    if (el.categoria_funcional !== categoriaEsperada) {
      throw new BadRequestException(
        `${comando} aplica solo a elementos de categoría ${categoriaEsperada}`,
      );
    }
    const pendiente = new Prisma.Decimal(el.valor_pendiente ?? 0);
    if (pendiente.lessThanOrEqualTo(0)) {
      throw new ConflictException('El elemento no tiene saldo pendiente');
    }
    const delta = new Prisma.Decimal(el.valor_vigente).negated(); // lleva valor_vigente a 0

    await this.prisma.$transaction(async (tx) => {
      await tx.elemento_patrimonial.update({
        where: { id: el.id },
        data: { valor_vigente: new Prisma.Decimal(0), valor_pendiente: new Prisma.Decimal(0) },
      });
      const entradaId = await this.auditoria.registrar(tx, {
        comando,
        usuarioId: actorId,
        entidadTipo: 'ELEMENTO_PATRIMONIAL',
        entidadId: el.id,
        motivo: dto.motivo,
        valorAnterior: {
          valor_pendiente: pendiente.toNumber(),
          valor_vigente: Number(el.valor_vigente),
        },
        valorPosterior: { valor_pendiente: 0, valor_vigente: 0 },
      });
      await tx.impacto_patrimonial.create({
        data: {
          elemento_id: el.id,
          monto: delta,
          origen_tipo: origenTipo,
          origen_id: entradaId,
          fecha: new Date(),
        },
      });
    });

    return this.obtenerElemento(el.id, actorId);
  }

  async #cargarActivo(elementoId: string, actorId: string): Promise<ElementoRow> {
    const el = await this.#cargarConPropietario(elementoId, actorId);
    if (el.estado !== 'ACTIVO') throw new ConflictException('El elemento no está activo');
    return el;
  }

  async #cargarConPropietario(elementoId: string, actorId: string): Promise<ElementoRow> {
    const el = await this.prisma.elemento_patrimonial.findUnique({ where: { id: elementoId } });
    if (!el) throw new NotFoundException('Elemento no encontrado');
    const prop = await this.prisma.elemento_propietario.findFirst({
      where: { elemento_id: elementoId, usuario_id: actorId },
    });
    if (!prop) throw new ForbiddenException('No eres propietario de ese elemento');
    return el;
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async listarPorPropietario(
    actorId: string,
    propietarioId: string,
    incluirInactivos = false,
    categoria?: string,
  ): Promise<ElementoPatrimonialDTO[]> {
    if (propietarioId !== actorId) {
      // Fase 2: solo puedes listar tus propios elementos. Ver GAPS.md G6.
      throw new ForbiddenException('Solo puedes listar tus propios elementos');
    }
    const filas = await this.prisma.elemento_propietario.findMany({
      where: { usuario_id: propietarioId },
      include: { elemento_patrimonial: true },
    });
    const visibles = filas.filter((f) => {
      if (!incluirInactivos && f.elemento_patrimonial.estado !== 'ACTIVO') return false;
      if (categoria && f.elemento_patrimonial.categoria_funcional !== categoria) return false;
      return true;
    });
    return Promise.all(visibles.map((f) => this.obtenerElemento(f.elemento_id, actorId)));
  }

  async obtenerElemento(elementoId: string, actorId: string): Promise<ElementoPatrimonialDTO> {
    const elemento = await this.prisma.elemento_patrimonial.findUnique({
      where: { id: elementoId },
    });
    if (!elemento) throw new NotFoundException('Elemento no encontrado');

    const propietarios = await this.prisma.elemento_propietario.findMany({
      where: { elemento_id: elementoId },
    });
    const esPropietario = propietarios.some((p) => p.usuario_id === actorId);
    if (!esPropietario && !(await this.visiblePorHogar(elemento, actorId))) {
      throw new NotFoundException('Elemento no encontrado');
    }

    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: propietarios.map((p) => p.usuario_id) } },
    });
    const nombrePorId = new Map(usuarios.map((u) => [u.id, u.nombre]));
    return toElementoDTO(
      elemento,
      propietarios.map((p) => ({ ...p, nombre: nombrePorId.get(p.usuario_id) })),
    );
  }

  async listarImpactos(elementoId: string, actorId: string): Promise<ImpactoPatrimonialDTO[]> {
    await this.obtenerElemento(elementoId, actorId); // valida acceso
    const impactos = await this.prisma.impacto_patrimonial.findMany({
      where: { elemento_id: elementoId },
      orderBy: { created_at: 'desc' },
    });
    // Excluir impactos cuya causa (evento financiero) fue anulada — DDD Sección F:
    // "si la causa desaparece, sus impactos asociados también desaparecen".
    const eventoIds = impactos
      .filter((i) => i.origen_tipo === 'EVENTO_FINANCIERO')
      .map((i) => i.origen_id);
    const anulados = new Set(
      (
        await this.prisma.evento_financiero.findMany({
          where: { id: { in: eventoIds }, anulado: true },
          select: { id: true },
        })
      ).map((e) => e.id),
    );
    return impactos
      .filter((i) => !(i.origen_tipo === 'EVENTO_FINANCIERO' && anulados.has(i.origen_id)))
      .map(toImpactoDTO);
  }

  // ── Helpers de acceso ─────────────────────────────────────────────────────

  /** Visibilidad simplificada (el esquema colapsó la config por-tipo a un enum). */
  private async visiblePorHogar(elemento: ElementoRow, actorId: string): Promise<boolean> {
    if (elemento.visibilidad === 'PRIVADA') return false;
    // COMPARTIDA / FAMILIAR: visible para co-miembros de hogar de algún propietario.
    // Aproximación de Fase 2 — ver GAPS.md G6.
    const propietarios = await this.prisma.elemento_propietario.findMany({
      where: { elemento_id: elemento.id },
      select: { usuario_id: true },
    });
    if (propietarios.length === 0) return false;
    const hogaresPropietarios = await this.prisma.membresia.findMany({
      where: { usuario_id: { in: propietarios.map((p) => p.usuario_id) }, estado: 'ACTIVA' },
      select: { hogar_id: true },
    });
    const hogaresActor = await this.prisma.membresia.findMany({
      where: { usuario_id: actorId, estado: 'ACTIVA' },
      select: { hogar_id: true },
    });
    const setActor = new Set(hogaresActor.map((m) => m.hogar_id));
    return hogaresPropietarios.some((m) => setActor.has(m.hogar_id));
  }
}
