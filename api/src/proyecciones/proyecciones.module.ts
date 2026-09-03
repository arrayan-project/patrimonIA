import { Module } from '@nestjs/common';
import { ProyeccionesController } from './proyecciones.controller.js';
import { ProyeccionesService } from './proyecciones.service.js';
import { ReconstruccionService } from './reconstruccion.service.js';

@Module({
  controllers: [ProyeccionesController],
  providers: [ProyeccionesService, ReconstruccionService],
  exports: [ProyeccionesService, ReconstruccionService],
})
export class ProyeccionesModule {}
