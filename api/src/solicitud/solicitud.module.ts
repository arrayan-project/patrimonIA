import { Module } from '@nestjs/common';
import { EventoFinancieroModule } from '../evento-financiero/evento.module.js';
import { ElementoModule } from '../elemento/elemento.module.js';
import { SolicitudController } from './solicitud.controller.js';
import { SolicitudService } from './solicitud.service.js';

@Module({
  imports: [EventoFinancieroModule, ElementoModule],
  controllers: [SolicitudController],
  providers: [SolicitudService],
})
export class SolicitudModule {}
