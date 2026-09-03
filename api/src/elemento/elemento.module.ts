import { Module } from '@nestjs/common';
import { ElementoController } from './elemento.controller.js';
import { ElementoService } from './elemento.service.js';

@Module({
  controllers: [ElementoController],
  providers: [ElementoService],
  exports: [ElementoService],
})
export class ElementoModule {}
