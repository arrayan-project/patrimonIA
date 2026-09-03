import { Module } from '@nestjs/common';
import { ProyeccionesController } from './proyecciones.controller.js';
import { ProyeccionesService } from './proyecciones.service.js';

@Module({
  controllers: [ProyeccionesController],
  providers: [ProyeccionesService],
})
export class ProyeccionesModule {}
