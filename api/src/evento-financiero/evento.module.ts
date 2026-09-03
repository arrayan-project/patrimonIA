import { Module } from '@nestjs/common';
import { EventoFinancieroController } from './evento.controller.js';
import { EventoFinancieroService } from './evento.service.js';
import { PlanificacionModule } from '../planificacion/planificacion.module.js';

@Module({
  imports: [PlanificacionModule],
  controllers: [EventoFinancieroController],
  providers: [EventoFinancieroService],
})
export class EventoFinancieroModule {}
