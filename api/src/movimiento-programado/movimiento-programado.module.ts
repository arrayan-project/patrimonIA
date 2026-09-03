import { Module } from '@nestjs/common';
import { MovimientoProgramadoController } from './movimiento-programado.controller.js';
import { MovimientoProgramadoService } from './movimiento-programado.service.js';

@Module({
  controllers: [MovimientoProgramadoController],
  providers: [MovimientoProgramadoService],
})
export class MovimientoProgramadoModule {}
