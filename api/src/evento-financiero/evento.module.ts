import { Module } from '@nestjs/common';
import { EventoFinancieroController } from './evento.controller.js';
import { EventoFinancieroService } from './evento.service.js';
import { PlanificacionModule } from '../planificacion/planificacion.module.js';
import { ElementoModule } from '../elemento/elemento.module.js';

@Module({
  imports: [PlanificacionModule, ElementoModule],
  controllers: [EventoFinancieroController],
  providers: [EventoFinancieroService],
})
export class EventoFinancieroModule {}
