import { Module } from '@nestjs/common';
import { AgrupacionController } from './agrupacion.controller.js';
import { AgrupacionService } from './agrupacion.service.js';

@Module({
  controllers: [AgrupacionController],
  providers: [AgrupacionService],
})
export class AgrupacionModule {}
