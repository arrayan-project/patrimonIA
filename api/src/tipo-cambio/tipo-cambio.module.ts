import { Global, Module } from '@nestjs/common';
import { ConversionService } from './conversion.service.js';
import { ImportacionTasasService } from './importacion-tasas.service.js';
import { TipoCambioController } from './tipo-cambio.controller.js';
import { TipoCambioService } from './tipo-cambio.service.js';

@Global()
@Module({
  controllers: [TipoCambioController],
  providers: [TipoCambioService, ConversionService, ImportacionTasasService],
  exports: [ConversionService],
})
export class TipoCambioModule {}
