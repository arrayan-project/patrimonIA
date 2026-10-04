import { Module } from '@nestjs/common';
import { EventoFinancieroModule } from '../evento-financiero/evento.module.js';
import { OtraPersonaController } from './otra-persona.controller.js';
import { OtraPersonaService } from './otra-persona.service.js';

@Module({
  imports: [EventoFinancieroModule],
  controllers: [OtraPersonaController],
  providers: [OtraPersonaService],
})
export class OtraPersonaModule {}
