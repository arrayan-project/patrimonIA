import { Module } from '@nestjs/common';
import { ElementoModule } from '../elemento/elemento.module.js';
import { PlantillaMovimientoController } from './plantilla-movimiento.controller.js';
import { PlantillaMovimientoService } from './plantilla-movimiento.service.js';

@Module({
  imports: [ElementoModule],
  controllers: [PlantillaMovimientoController],
  providers: [PlantillaMovimientoService],
})
export class PlantillaMovimientoModule {}
