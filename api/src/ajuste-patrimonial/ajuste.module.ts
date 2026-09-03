import { Module } from '@nestjs/common';
import { AjustePatrimonialController } from './ajuste.controller.js';
import { AjustePatrimonialService } from './ajuste.service.js';

@Module({
  controllers: [AjustePatrimonialController],
  providers: [AjustePatrimonialService],
})
export class AjustePatrimonialModule {}
