import { Global, Module } from '@nestjs/common';
import { CategoriaMovimientoController } from './categoria-movimiento.controller.js';
import { CategoriaMovimientoService } from './categoria-movimiento.service.js';

@Global()
@Module({
  controllers: [CategoriaMovimientoController],
  providers: [CategoriaMovimientoService],
  exports: [CategoriaMovimientoService],
})
export class CategoriaMovimientoModule {}
