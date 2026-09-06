import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { NotificacionService } from '../notificacion/notificacion.service.js';
import { CategoriaMovimientoService } from '../categoria-movimiento/categoria-movimiento.service.js';
import { TipoElementoService } from '../tipo-elemento/tipo-elemento.service.js';
import {
  toHogarDTO,
  toInvitacionDTO,
  toMembresiaDTO,
  type HogarDTO,
  type InvitacionDTO,
  type MembresiaDTO,
  type MiembroDTO,
} from './hogar.dto.js';

const MONEDA_PLACEHOLDER = 'CLP'; // ver GAPS.md

@Injectable()
export class HogarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly notificaciones: NotificacionService,
    private readonly categorias: CategoriaMovimientoService,
    private readonly tiposElemento: TipoElementoService,
  ) {}

  // ── Comandos ──────────────────────────────────────────────────────────────

  /**
   * AS #34 — CrearHogar. El usuario creador se vuelve ADMINISTRADOR
   * automáticamente (política 1-a-1 muda → embebida en la misma entrada de
   * auditoría). Auditoría: Creación — usuario, nombre.
   */
  async crearHogar(input: {
    creadorId: string;
    nombre: string;
    monedaConsolidacion?: string;
  }): Promise<HogarDTO> {
    const moneda = input.monedaConsolidacion ?? MONEDA_PLACEHOLDER;

    const hogar = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.hogar.create({
        data: { nombre: input.nombre, moneda_consolidacion: moneda },
      });

      await tx.membresia.create({
        data: {
          hogar_id: creado.id,
          usuario_id: input.creadorId,
          rol: 'ADMINISTRADOR',
          estado: 'ACTIVA',
        },
      });

      await this.categorias.sembrarPorDefecto(tx, creado.id);
      await this.tiposElemento.sembrarPorDefecto(tx, creado.id);

      await this.auditoria.registrar(tx, {
        comando: 'CrearHogar',
        usuarioId: input.creadorId,
        entidadTipo: 'HOGAR',
        entidadId: creado.id,
        valorPosterior: { nombre: creado.nombre, moneda_consolidacion: moneda },
      });

      return creado;
    });

    return toHogarDTO(hogar);
  }

  /**
   * AS #37 — InvitarMiembro. Validación: solo un administrador puede invitar.
   * Auditoría: Invitación — emisor, invitado.
   */
  async invitarMiembro(input: {
    emisorId: string;
    hogarId: string;
    emailInvitado: string;
  }): Promise<InvitacionDTO> {
    const hogar = await this.prisma.hogar.findUnique({ where: { id: input.hogarId } });
    if (!hogar) throw new NotFoundException('El hogar no existe');

    await this.exigirAdministrador(input.hogarId, input.emisorId);

    const invitado = await this.prisma.usuario.findUnique({
      where: { email: input.emailInvitado },
    });
    if (!invitado) {
      throw new NotFoundException('El usuario invitado no está registrado');
    }

    // Guardas provisionales derivadas de invariantes ya existentes (ver GAPS.md):
    const membresiaActiva = await this.prisma.membresia.findFirst({
      where: { hogar_id: input.hogarId, usuario_id: invitado.id, estado: 'ACTIVA' },
    });
    if (membresiaActiva) {
      throw new ConflictException('El usuario ya es miembro activo del hogar');
    }
    const pendiente = await this.prisma.invitacion.findFirst({
      where: { hogar_id: input.hogarId, invitado_id: invitado.id, estado: 'PENDIENTE' },
    });
    if (pendiente) {
      return toInvitacionDTO(pendiente, hogar.nombre);
    }

    const invitacion = await this.prisma.$transaction(async (tx) => {
      const creada = await tx.invitacion.create({
        data: {
          hogar_id: input.hogarId,
          emisor_id: input.emisorId,
          invitado_id: invitado.id,
          estado: 'PENDIENTE',
        },
      });

      await this.auditoria.registrar(tx, {
        comando: 'InvitarMiembro',
        usuarioId: input.emisorId,
        entidadTipo: 'INVITACION',
        entidadId: creada.id,
        valorPosterior: {
          hogar_id: creada.hogar_id,
          emisor_id: creada.emisor_id,
          invitado_id: creada.invitado_id,
          estado: creada.estado,
        },
        entidadRelacionadaTipo: 'HOGAR',
        entidadRelacionadaId: input.hogarId,
      });

      await this.notificaciones.emitir(tx, {
        usuarioId: invitado.id,
        tipo: 'INVITACION_RECIBIDA',
        titulo: 'Te invitaron a un hogar',
        cuerpo: `Tienes una invitación pendiente para unirte a "${hogar.nombre}".`,
        entidadTipo: 'INVITACION',
        entidadId: creada.id,
      });

      return creada;
    });

    return toInvitacionDTO(invitacion, hogar.nombre);
  }

  /**
   * AS #38 — AceptarInvitacion. Dispara la política interna UnirseAHogar (crea
   * membresía, rol MIEMBRO) — 1-a-1 muda, embebida en la misma entrada.
   * Auditoría: Aceptación — usuario, hogar.
   */
  async aceptarInvitacion(input: {
    usuarioId: string;
    invitacionId: string;
  }): Promise<MembresiaDTO> {
    const invitacion = await this.cargarInvitacionDirigida(input.invitacionId, input.usuarioId);

    const yaMiembro = await this.prisma.membresia.findFirst({
      where: { hogar_id: invitacion.hogar_id, usuario_id: input.usuarioId, estado: 'ACTIVA' },
    });
    if (yaMiembro) {
      throw new ConflictException('Ya eres miembro activo de este hogar');
    }

    const membresia = await this.prisma.$transaction(async (tx) => {
      await tx.invitacion.update({
        where: { id: invitacion.id },
        data: { estado: 'ACEPTADA' },
      });

      const nueva = await tx.membresia.create({
        data: {
          hogar_id: invitacion.hogar_id,
          usuario_id: input.usuarioId,
          rol: 'MIEMBRO',
          estado: 'ACTIVA',
        },
      });

      await this.auditoria.registrar(tx, {
        comando: 'AceptarInvitacion',
        usuarioId: input.usuarioId,
        entidadTipo: 'INVITACION',
        entidadId: invitacion.id,
        valorAnterior: { estado: 'PENDIENTE' },
        valorPosterior: { estado: 'ACEPTADA' },
        entidadRelacionadaTipo: 'MEMBRESIA',
        entidadRelacionadaId: nueva.id,
      });

      return nueva;
    });

    return toMembresiaDTO(membresia);
  }

  /**
   * AS #39 — RechazarInvitacion. Cierra la invitación pendiente, sin membresía.
   * Auditoría: Rechazo — usuario, hogar.
   */
  async rechazarInvitacion(input: {
    usuarioId: string;
    invitacionId: string;
  }): Promise<{ ok: true }> {
    const invitacion = await this.cargarInvitacionDirigida(input.invitacionId, input.usuarioId);

    await this.prisma.$transaction(async (tx) => {
      await tx.invitacion.update({
        where: { id: invitacion.id },
        data: { estado: 'RECHAZADA' },
      });

      await this.auditoria.registrar(tx, {
        comando: 'RechazarInvitacion',
        usuarioId: input.usuarioId,
        entidadTipo: 'INVITACION',
        entidadId: invitacion.id,
        valorAnterior: { estado: 'PENDIENTE' },
        valorPosterior: { estado: 'RECHAZADA' },
        entidadRelacionadaTipo: 'HOGAR',
        entidadRelacionadaId: invitacion.hogar_id,
      });
    });

    return { ok: true };
  }

  /** AS #35 — ActualizarDatosHogar. Solo un administrador. */
  async actualizarDatosHogar(actorId: string, hogarId: string, nombre: string): Promise<HogarDTO> {
    await this.exigirAdministrador(hogarId, actorId);
    const hogar = await this.prisma.hogar.findUniqueOrThrow({ where: { id: hogarId } });
    if (hogar.nombre === nombre) throw new ConflictException('Sin cambios');
    await this.prisma.$transaction(async (tx) => {
      await tx.hogar.update({ where: { id: hogarId }, data: { nombre } });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarDatosHogar',
        usuarioId: actorId,
        entidadTipo: 'HOGAR',
        entidadId: hogarId,
        valorAnterior: { nombre: hogar.nombre },
        valorPosterior: { nombre },
      });
    });
    return this.obtenerHogar(hogarId, actorId);
  }

  /**
   * AS #36 — CambiarMonedaConsolidacion. Solo un administrador. El recálculo de
   * consolidaciones en la nueva moneda (W) queda pendiente: no hay proyección de
   * consolidación ni tipos de cambio todavía (GAPS.md G7).
   */
  async cambiarMonedaConsolidacion(
    actorId: string,
    hogarId: string,
    moneda: string,
  ): Promise<HogarDTO> {
    await this.exigirAdministrador(hogarId, actorId);
    const hogar = await this.prisma.hogar.findUniqueOrThrow({ where: { id: hogarId } });
    const nueva = moneda.toUpperCase();
    if (hogar.moneda_consolidacion === nueva) throw new ConflictException('Sin cambios');
    await this.prisma.$transaction(async (tx) => {
      await tx.hogar.update({ where: { id: hogarId }, data: { moneda_consolidacion: nueva } });
      await this.auditoria.registrar(tx, {
        comando: 'CambiarMonedaConsolidacion',
        usuarioId: actorId,
        entidadTipo: 'HOGAR',
        entidadId: hogarId,
        valorAnterior: { moneda_consolidacion: hogar.moneda_consolidacion },
        valorPosterior: { moneda_consolidacion: nueva },
      });
    });
    return this.obtenerHogar(hogarId, actorId);
  }

  /** AS #40 — AsignarRol. Debe quedar ≥1 administrador tras el cambio. */
  async asignarRol(
    actorId: string,
    hogarId: string,
    usuarioId: string,
    rol: 'ADMINISTRADOR' | 'MIEMBRO',
  ): Promise<MiembroDTO[]> {
    await this.exigirAdministrador(hogarId, actorId);
    const membresia = await this.prisma.membresia.findFirst({
      where: { hogar_id: hogarId, usuario_id: usuarioId, estado: 'ACTIVA' },
    });
    if (!membresia) throw new NotFoundException('El usuario no es miembro activo del hogar');
    if (membresia.rol === rol) throw new ConflictException('El miembro ya tiene ese rol');

    if (rol === 'MIEMBRO') {
      const admins = await this.prisma.membresia.count({
        where: { hogar_id: hogarId, estado: 'ACTIVA', rol: 'ADMINISTRADOR' },
      });
      if (admins <= 1) {
        throw new ConflictException('El hogar debe quedar con al menos un administrador');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.membresia.update({ where: { id: membresia.id }, data: { rol } });
      await this.auditoria.registrar(tx, {
        comando: 'AsignarRol',
        usuarioId: actorId,
        entidadTipo: 'MEMBRESIA',
        entidadId: membresia.id,
        valorAnterior: { rol: membresia.rol },
        valorPosterior: { rol },
        entidadRelacionadaTipo: 'HOGAR',
        entidadRelacionadaId: hogarId,
      });
    });
    return this.listarMiembros(hogarId, actorId);
  }

  /** AS #41 — RemoverMiembro. No puede ser el último administrador. */
  async removerMiembro(
    actorId: string,
    hogarId: string,
    usuarioId: string,
    motivo: string,
  ): Promise<{ ok: true }> {
    await this.exigirAdministrador(hogarId, actorId);
    const membresia = await this.prisma.membresia.findFirst({
      where: { hogar_id: hogarId, usuario_id: usuarioId, estado: 'ACTIVA' },
    });
    if (!membresia) throw new NotFoundException('El usuario no es miembro activo del hogar');
    await this.#exigirNoUltimoAdministrador(hogarId, membresia.rol);

    await this.prisma.$transaction(async (tx) => {
      await tx.membresia.update({ where: { id: membresia.id }, data: { estado: 'SALIDA' } });
      await this.auditoria.registrar(tx, {
        comando: 'RemoverMiembro',
        usuarioId: actorId,
        entidadTipo: 'MEMBRESIA',
        entidadId: membresia.id,
        motivo,
        valorAnterior: { estado: 'ACTIVA' },
        valorPosterior: { estado: 'SALIDA' },
        entidadRelacionadaTipo: 'HOGAR',
        entidadRelacionadaId: hogarId,
      });
    });
    return { ok: true };
  }

  /** AS #45 — SalirDeHogar. No puede ser el último administrador. */
  async salirDeHogar(actorId: string, hogarId: string): Promise<{ ok: true }> {
    const membresia = await this.prisma.membresia.findFirst({
      where: { hogar_id: hogarId, usuario_id: actorId, estado: 'ACTIVA' },
    });
    if (!membresia) throw new NotFoundException('No perteneces a este hogar');
    await this.#exigirNoUltimoAdministrador(hogarId, membresia.rol);

    await this.prisma.$transaction(async (tx) => {
      await tx.membresia.update({ where: { id: membresia.id }, data: { estado: 'SALIDA' } });
      await this.auditoria.registrar(tx, {
        comando: 'SalirDeHogar',
        usuarioId: actorId,
        entidadTipo: 'MEMBRESIA',
        entidadId: membresia.id,
        valorAnterior: { estado: 'ACTIVA' },
        valorPosterior: { estado: 'SALIDA' },
        entidadRelacionadaTipo: 'HOGAR',
        entidadRelacionadaId: hogarId,
      });
    });
    return { ok: true };
  }

  /**
   * AS #42 — EliminarHogar. Solo un administrador. Desaparece la entidad
   * organizativa y sus vínculos; los elementos patrimoniales sobreviven
   * (Principio 3: la app no es dueña del patrimonio).
   */
  async eliminarHogar(actorId: string, hogarId: string, motivo: string): Promise<{ ok: true }> {
    await this.exigirAdministrador(hogarId, actorId);
    const miembros = await this.prisma.membresia.findMany({
      where: { hogar_id: hogarId, estado: 'ACTIVA' },
      select: { usuario_id: true },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.invitacion.deleteMany({ where: { hogar_id: hogarId } });
      await tx.membresia.deleteMany({ where: { hogar_id: hogarId } });
      // Categorías del hogar: si algún evento las usa, se desvincula (no se borra
      // el hecho económico); las categorías en sí son config y se eliminan.
      await tx.evento_financiero.updateMany({
        where: { categoria_movimiento: { hogar_id: hogarId } },
        data: { categoria_id: null },
      });
      await tx.categoria_movimiento.deleteMany({ where: { hogar_id: hogarId } });
      await tx.tipo_elemento.deleteMany({ where: { hogar_id: hogarId } });
      await tx.hogar.delete({ where: { id: hogarId } });
      await this.auditoria.registrar(tx, {
        comando: 'EliminarHogar',
        usuarioId: actorId,
        entidadTipo: 'HOGAR',
        entidadId: hogarId,
        motivo,
        valorAnterior: { miembros_desvinculados: miembros.map((m) => m.usuario_id) },
      });
    });
    return { ok: true };
  }

  async #exigirNoUltimoAdministrador(hogarId: string, rol: string): Promise<void> {
    if (rol !== 'ADMINISTRADOR') return;
    const admins = await this.prisma.membresia.count({
      where: { hogar_id: hogarId, estado: 'ACTIVA', rol: 'ADMINISTRADOR' },
    });
    if (admins <= 1) {
      throw new ConflictException('No puede salir el último administrador del hogar');
    }
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async obtenerHogar(hogarId: string, solicitanteId: string): Promise<HogarDTO> {
    await this.exigirMiembro(hogarId, solicitanteId);
    const hogar = await this.prisma.hogar.findUnique({ where: { id: hogarId } });
    if (!hogar) throw new NotFoundException('El hogar no existe');
    return toHogarDTO(hogar, await this.listarMiembros(hogarId, solicitanteId));
  }

  async listarMiembros(hogarId: string, solicitanteId: string): Promise<MiembroDTO[]> {
    await this.exigirMiembro(hogarId, solicitanteId);
    const membresias = await this.prisma.membresia.findMany({
      where: { hogar_id: hogarId, estado: 'ACTIVA' },
      orderBy: { created_at: 'asc' },
    });
    const usuarios = await this.prisma.usuario.findMany({
      where: { id: { in: membresias.map((m) => m.usuario_id) } },
    });
    const porId = new Map(usuarios.map((u) => [u.id, u]));
    return membresias.map((m) => {
      const u = porId.get(m.usuario_id);
      return {
        usuarioId: m.usuario_id,
        nombre: u?.nombre ?? '',
        email: u?.email ?? '',
        rol: m.rol,
        desde: m.created_at.toISOString(),
      };
    });
  }

  async listarInvitacionesHogar(
    hogarId: string,
    solicitanteId: string,
    estado?: string,
  ): Promise<InvitacionDTO[]> {
    await this.exigirAdministrador(hogarId, solicitanteId);
    const invitaciones = await this.prisma.invitacion.findMany({
      where: { hogar_id: hogarId, ...(estado ? { estado } : {}) },
      orderBy: { created_at: 'desc' },
    });
    return invitaciones.map((i) => toInvitacionDTO(i));
  }

  /**
   * Read projection para la pantalla del invitado (UX_FLOWS Flujo 2, paso 4).
   * No está en API_DESIGN como endpoint nombrado, pero las consultas no son un
   * catálogo cerrado. Ver GAPS.md.
   */
  async listarInvitacionesRecibidas(
    usuarioId: string,
    estado?: string,
  ): Promise<InvitacionDTO[]> {
    const invitaciones = await this.prisma.invitacion.findMany({
      where: { invitado_id: usuarioId, ...(estado ? { estado } : {}) },
      orderBy: { created_at: 'desc' },
    });
    const hogares = await this.prisma.hogar.findMany({
      where: { id: { in: invitaciones.map((i) => i.hogar_id) } },
    });
    const nombrePorId = new Map(hogares.map((h) => [h.id, h.nombre]));
    return invitaciones.map((i) => toInvitacionDTO(i, nombrePorId.get(i.hogar_id)));
  }

  async listarHogaresDeUsuario(usuarioId: string): Promise<HogarDTO[]> {
    const membresias = await this.prisma.membresia.findMany({
      where: { usuario_id: usuarioId, estado: 'ACTIVA' },
    });
    const hogares = await this.prisma.hogar.findMany({
      where: { id: { in: membresias.map((m) => m.hogar_id) } },
      orderBy: { created_at: 'asc' },
    });
    return hogares.map((h) => toHogarDTO(h));
  }

  // ── Helpers de autorización (viven en el Application Service, no en el guard) ─

  private async exigirMiembro(hogarId: string, usuarioId: string): Promise<void> {
    const membresia = await this.prisma.membresia.findFirst({
      where: { hogar_id: hogarId, usuario_id: usuarioId, estado: 'ACTIVA' },
    });
    if (!membresia) {
      throw new ForbiddenException('No perteneces a este hogar');
    }
  }

  private async exigirAdministrador(hogarId: string, usuarioId: string): Promise<void> {
    const membresia = await this.prisma.membresia.findFirst({
      where: {
        hogar_id: hogarId,
        usuario_id: usuarioId,
        estado: 'ACTIVA',
        rol: 'ADMINISTRADOR',
      },
    });
    if (!membresia) {
      throw new ForbiddenException('Solo un administrador del hogar puede hacer esto');
    }
  }

  private async cargarInvitacionDirigida(invitacionId: string, usuarioId: string) {
    const invitacion = await this.prisma.invitacion.findUnique({ where: { id: invitacionId } });
    if (!invitacion || invitacion.invitado_id !== usuarioId) {
      // No revelar la existencia de invitaciones ajenas.
      throw new NotFoundException('Invitación no encontrada');
    }
    if (invitacion.estado !== 'PENDIENTE') {
      throw new ConflictException('La invitación ya no está pendiente');
    }
    return invitacion;
  }
}
