import { Module } from '@nestjs/common';
import { ElementoModule } from '../elemento/elemento.module.js';
import { MovimientoProgramadoController } from './movimiento-programado.controller.js';
import { MovimientoProgramadoService } from './movimiento-programado.service.js';

@Module({
  imports: [ElementoModule],
  controllers: [MovimientoProgramadoController],
  providers: [MovimientoProgramadoService],
})
export class MovimientoProgramadoModule {}
