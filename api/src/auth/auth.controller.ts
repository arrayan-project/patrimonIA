import { Body, Controller, HttpCode, Ip, Post, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService, type LoginResult } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegistroTokenDto } from './dto/registro-token.dto.js';
import { Public } from './public.decorator.js';
import { RateLimiter } from '../common/rate-limiter.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly rate: RateLimiter,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Post('registro-token')
  @HttpCode(200)
  tokenRegistro(@Body() dto: RegistroTokenDto, @Ip() ip: string) {
    // 10 solicitudes por IP por hora
    if (!this.rate.permitir(`registro-token:${ip}`, 10, 60 * 60 * 1000)) {
      throw new HttpException('Demasiadas solicitudes, intenta más tarde', HttpStatus.TOO_MANY_REQUESTS);
    }
    return this.auth.emitirTokenRegistro(dto.email);
  }
}
