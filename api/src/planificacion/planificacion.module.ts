import { Module } from '@nestjs/common';
import { PlanificacionController } from './planificacion.controller.js';
import { ProgresoService } from './progreso.service.js';
import { ObjetivoService } from './objetivo.service.js';
import { AsignacionService } from './asignacion.service.js';
import { ReservaService } from './reserva.service.js';

@Module({
  controllers: [PlanificacionController],
  providers: [ProgresoService, ObjetivoService, AsignacionService, ReservaService],
  exports: [ProgresoService],
})
export class PlanificacionModule {}
