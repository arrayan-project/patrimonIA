import { Module } from '@nestjs/common';
import { ElementoModule } from '../elemento/elemento.module.js';
import { PresupuestoController } from './presupuesto.controller.js';
import { PresupuestoService } from './presupuesto.service.js';

@Module({
  imports: [ElementoModule],
  controllers: [PresupuestoController],
  providers: [PresupuestoService],
})
export class PresupuestoModule {}
