import { Module } from '@nestjs/common';
import { EventoFinancieroController } from './evento.controller.js';
import { EventoFinancieroService } from './evento.service.js';

@Module({
  controllers: [EventoFinancieroController],
  providers: [EventoFinancieroService],
})
export class EventoFinancieroModule {}
