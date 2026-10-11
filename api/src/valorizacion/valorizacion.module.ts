import { Module } from '@nestjs/common';
import { PlanificacionModule } from '../planificacion/planificacion.module.js';
import { ValorizacionController } from './valorizacion.controller.js';
import { ValorizacionService } from './valorizacion.service.js';

@Module({
  imports: [PlanificacionModule],
  controllers: [ValorizacionController],
  providers: [ValorizacionService],
})
export class ValorizacionModule {}
