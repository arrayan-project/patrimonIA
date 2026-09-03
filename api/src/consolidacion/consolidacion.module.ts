import { Module } from '@nestjs/common';
import { PlanificacionModule } from '../planificacion/planificacion.module.js';
import { ConsolidacionController } from './consolidacion.controller.js';
import { ConsolidacionService } from './consolidacion.service.js';

@Module({
  imports: [PlanificacionModule],
  controllers: [ConsolidacionController],
  providers: [ConsolidacionService],
})
export class ConsolidacionModule {}
