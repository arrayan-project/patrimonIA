import { Module } from '@nestjs/common';
import { ValorizacionController } from './valorizacion.controller.js';
import { ValorizacionService } from './valorizacion.service.js';

@Module({
  controllers: [ValorizacionController],
  providers: [ValorizacionService],
})
export class ValorizacionModule {}
