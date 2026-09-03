import { Global, Module } from '@nestjs/common';
import { EtiquetaController } from './etiqueta.controller.js';
import { EtiquetaService } from './etiqueta.service.js';

@Global()
@Module({
  controllers: [EtiquetaController],
  providers: [EtiquetaService],
  exports: [EtiquetaService],
})
export class EtiquetaModule {}
