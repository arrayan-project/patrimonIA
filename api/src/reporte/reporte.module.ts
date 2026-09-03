import { Module } from '@nestjs/common';
import { ReporteController } from './reporte.controller.js';
import { ReporteService } from './reporte.service.js';

@Module({
  controllers: [ReporteController],
  providers: [ReporteService],
})
export class ReporteModule {}
