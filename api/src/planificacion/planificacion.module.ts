import { Module } from '@nestjs/common';
import { PlanificacionController } from './planificacion.controller.js';
import { ProgresoService } from './progreso.service.js';
import { ObjetivoService } from './objetivo.service.js';
import { AsignacionService } from './asignacion.service.js';
import { ReservaService } from './reserva.service.js';
import { CuentaDedicadaService } from './cuenta-dedicada.service.js';

@Module({
  controllers: [PlanificacionController],
  providers: [ProgresoService, ObjetivoService, AsignacionService, ReservaService, CuentaDedicadaService],
  exports: [ProgresoService, ReservaService],
})
export class PlanificacionModule {}
