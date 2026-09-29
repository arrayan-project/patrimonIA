import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CodigoVerificacionService } from './codigo-verificacion.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { crearEmailSender, EMAIL_SENDER } from './email-sender.js';
import { RateLimiter } from '../common/rate-limiter.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CodigoVerificacionService,
    RateLimiter,
    { provide: EMAIL_SENDER, useFactory: () => crearEmailSender() },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, jwt: JwtService, prisma: PrismaService) =>
        new JwtAuthGuard(reflector, jwt, prisma),
      inject: [Reflector, JwtService, PrismaService],
    },
  ],
  exports: [JwtModule, EMAIL_SENDER],
})
export class AuthModule {}
