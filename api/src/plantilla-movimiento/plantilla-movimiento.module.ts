import { Module } from '@nestjs/common';
import { PlantillaMovimientoController } from './plantilla-movimiento.controller.js';
import { PlantillaMovimientoService } from './plantilla-movimiento.service.js';

@Module({
  controllers: [PlantillaMovimientoController],
  providers: [PlantillaMovimientoService],
})
export class PlantillaMovimientoModule {}
