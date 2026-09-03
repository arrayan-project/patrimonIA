import { Global, Module } from '@nestjs/common';
import { NotificacionController } from './notificacion.controller.js';
import { NotificacionService } from './notificacion.service.js';

@Global()
@Module({
  controllers: [NotificacionController],
  providers: [NotificacionService],
  exports: [NotificacionService],
})
export class NotificacionModule {}
