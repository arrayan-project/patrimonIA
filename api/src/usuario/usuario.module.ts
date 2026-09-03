import { Module } from '@nestjs/common';
import { UsuarioController } from './usuario.controller.js';
import { UsuarioService } from './usuario.service.js';
import { RegistroTokenGuard } from '../auth/registro-token.guard.js';

@Module({
  controllers: [UsuarioController],
  providers: [UsuarioService, RegistroTokenGuard],
  exports: [UsuarioService],
})
export class UsuarioModule {}
