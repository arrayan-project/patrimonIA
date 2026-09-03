import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { hashPassword } from '../common/password.js';
import { toUsuarioDTO, type UsuarioDTO } from './usuario.dto.js';

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
        entidadTipo: 'Usuario',
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
}
