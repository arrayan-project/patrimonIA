import { Module } from '@nestjs/common';
import { ElementoModule } from '../elemento/elemento.module.js';
import { ReporteController } from './reporte.controller.js';
import { ReporteService } from './reporte.service.js';

@Module({
  imports: [ElementoModule],
  controllers: [ReporteController],
  providers: [ReporteService],
})
export class ReporteModule {}
