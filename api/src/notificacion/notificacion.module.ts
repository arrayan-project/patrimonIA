import { Global, Module } from '@nestjs/common';
import { NotificacionController } from './notificacion.controller.js';
import { NotificacionService } from './notificacion.service.js';
import { ExpoPushSender, PUSH_SENDER } from './push-sender.js';

@Global()
@Module({
  controllers: [NotificacionController],
  providers: [NotificacionService, { provide: PUSH_SENDER, useClass: ExpoPushSender }],
  exports: [NotificacionService],
})
export class NotificacionModule {}
