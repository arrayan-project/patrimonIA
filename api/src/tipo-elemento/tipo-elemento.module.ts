import { Global, Module } from '@nestjs/common';
import { TipoElementoController } from './tipo-elemento.controller.js';
import { TipoElementoService } from './tipo-elemento.service.js';

@Global()
@Module({
  controllers: [TipoElementoController],
  providers: [TipoElementoService],
  exports: [TipoElementoService],
})
export class TipoElementoModule {}
