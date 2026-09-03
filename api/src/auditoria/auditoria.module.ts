import { Global, Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service.js';

@Global()
@Module({
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
