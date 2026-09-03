import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { hashPassword } from '../common/password.js';
import { toUsuarioDTO, type UsuarioDTO } from './usuario.dto.js';
import type {
  ActualizarDatosUsuarioDto,
  DesactivarUsuarioDto,
} from './dto/comandos-usuario.dto.js';

@Injectable()
export class UsuarioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * AS #43 — RegistrarUsuario.
   * Validaciones: ninguna sobre hogar (el usuario existe momentáneamente sin
   * hogar durante el alta). Auditoría: Creación — usuario.
   */
  async registrarUsuario(input: {
    email: string;
    nombre: string;
    password: string;
  }): Promise<UsuarioDTO> {
    const yaExiste = await this.prisma.usuario.findUnique({ where: { email: input.email } });
    if (yaExiste) {
      throw new ConflictException('Ya existe un usuario con ese email');
    }

    const passwordHash = await hashPassword(input.password);

    const usuario = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.usuario.create({
        data: {
          email: input.email,
          nombre: input.nombre,
          password_hash: passwordHash,
          estado: 'ACTIVO',
        },
      });

      await this.auditoria.registrar(tx, {
        comando: 'RegistrarUsuario',
        usuarioId: creado.id,
        entidadTipo: 'USUARIO',
        entidadId: creado.id,
        valorPosterior: { email: creado.email, nombre: creado.nombre },
      });

      return creado;
    });

    return toUsuarioDTO(usuario);
  }

  async obtenerPorId(id: string): Promise<UsuarioDTO | null> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    return usuario ? toUsuarioDTO(usuario) : null;
  }

  /** AS #44 — ActualizarDatosUsuario (identidad, preferencias globales). */
  async actualizarDatos(actorId: string, dto: ActualizarDatosUsuarioDto): Promise<UsuarioDTO> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: actorId } });
    const data: Prisma.usuarioUpdateInput = {};
    const anterior: Record<string, unknown> = {};
    const posterior: Record<string, unknown> = {};
    if (dto.nombre !== undefined && dto.nombre !== usuario.nombre) {
      data.nombre = dto.nombre;
      anterior.nombre = usuario.nombre;
      posterior.nombre = dto.nombre;
    }
    if (dto.preferencias !== undefined) {
      data.preferencias = dto.preferencias as Prisma.InputJsonValue;
      posterior.preferencias = dto.preferencias;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('No hay cambios');

    const actualizado = await this.prisma.$transaction(async (tx) => {
      const u = await tx.usuario.update({ where: { id: actorId }, data });
      await this.auditoria.registrar(tx, {
        comando: 'ActualizarDatosUsuario',
        usuarioId: actorId,
        entidadTipo: 'USUARIO',
        entidadId: actorId,
        valorAnterior: anterior,
        valorPosterior: posterior,
      });
      return u;
    });
    return toUsuarioDTO(actualizado);
  }

  /** AS #46 — DesactivarUsuario. Elementos y membresías históricas se conservan. */
  async desactivar(actorId: string, dto: DesactivarUsuarioDto): Promise<{ ok: true }> {
    const usuario = await this.prisma.usuario.findUniqueOrThrow({ where: { id: actorId } });
    if (usuario.estado !== 'ACTIVO') throw new ConflictException('El usuario ya está desactivado');
    await this.prisma.$transaction(async (tx) => {
      await tx.usuario.update({ where: { id: actorId }, data: { estado: 'DESACTIVADO' } });
      await this.auditoria.registrar(tx, {
        comando: 'DesactivarUsuario',
        usuarioId: actorId,
        entidadTipo: 'USUARIO',
        entidadId: actorId,
        motivo: dto.motivo,
        valorAnterior: { estado: 'ACTIVO' },
        valorPosterior: { estado: 'DESACTIVADO' },
      });
    });
    return { ok: true };
  }
}
