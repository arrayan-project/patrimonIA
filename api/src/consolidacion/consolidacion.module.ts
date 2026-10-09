import { Module } from '@nestjs/common';
import { PlanificacionModule } from '../planificacion/planificacion.module.js';
import { ElementoModule } from '../elemento/elemento.module.js';
import { ConsolidacionController } from './consolidacion.controller.js';
import { ConsolidacionService } from './consolidacion.service.js';

@Module({
  imports: [PlanificacionModule, ElementoModule],
  controllers: [ConsolidacionController],
  providers: [ConsolidacionService],
})
export class ConsolidacionModule {}
