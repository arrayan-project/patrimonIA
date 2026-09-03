import { Module } from '@nestjs/common';
import { HogarController } from './hogar.controller.js';
import { HogarService } from './hogar.service.js';

@Module({
  controllers: [HogarController],
  providers: [HogarService],
})
export class HogarModule {}
