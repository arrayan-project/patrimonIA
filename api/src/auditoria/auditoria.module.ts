import { Global, Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service.js';
import { HistorialService } from './historial.service.js';
import { HistorialController } from './historial.controller.js';

@Global()
@Module({
  controllers: [HistorialController],
  providers: [AuditoriaService, HistorialService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
