import { Module } from '@nestjs/common';
import { PresupuestoController } from './presupuesto.controller.js';
import { PresupuestoService } from './presupuesto.service.js';

@Module({
  controllers: [PresupuestoController],
  providers: [PresupuestoService],
})
export class PresupuestoModule {}
