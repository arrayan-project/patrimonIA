import { Module } from '@nestjs/common';
import { PlanificacionModule } from '../planificacion/planificacion.module.js';
import { EventoFinancieroModule } from '../evento-financiero/evento.module.js';
import { AhorroController } from './ahorro.controller.js';
import { AhorroService } from './ahorro.service.js';

@Module({
  imports: [PlanificacionModule, EventoFinancieroModule],
  controllers: [AhorroController],
  providers: [AhorroService],
})
export class AhorroModule {}
