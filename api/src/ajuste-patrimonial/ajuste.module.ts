import { Module } from '@nestjs/common';
import { PlanificacionModule } from '../planificacion/planificacion.module.js';
import { AjustePatrimonialController } from './ajuste.controller.js';
import { AjustePatrimonialService } from './ajuste.service.js';

@Module({
  imports: [PlanificacionModule],
  controllers: [AjustePatrimonialController],
  providers: [AjustePatrimonialService],
})
export class AjustePatrimonialModule {}
