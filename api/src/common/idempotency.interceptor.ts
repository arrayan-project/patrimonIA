import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Observable, from, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Idempotencia de comandos (API_DESIGN §43): si un `POST /comandos/*` llega con
 * header `Idempotency-Key` y ya se procesó esa clave para este usuario, se
 * devuelve la respuesta guardada en vez de re-ejecutar. Infraestructura, no
 * dominio.
 *
 * Ventana de carrera mínima: dos requests simultáneos con la misma clave — el
 * segundo recibe 409 mientras el primero está en curso.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const clave: string | undefined = req.headers['idempotency-key'];
    const usuarioId: string | undefined = req.user?.id;

    if (
      req.method !== 'POST' ||
      !clave ||
      !usuarioId ||
      !String(req.path).startsWith('/comandos/')
    ) {
      return next.handle();
    }

    const endpoint = req.path;

    return from(this.#reclamar(clave, usuarioId, endpoint)).pipe(
      switchMap((existente) => {
        if (existente === 'EN_CURSO') {
          throw new ConflictException('Ya hay una solicitud idéntica en curso (Idempotency-Key)');
        }
        if (existente) {
          res.status(existente.status_code ?? 200);
          return of(existente.respuesta);
        }
        return next.handle().pipe(
          tap({
            next: (body) => {
              void this.#guardar(clave, usuarioId, res.statusCode ?? 201, body);
            },
            error: () => {
              void this.#liberar(clave, usuarioId);
            },
          }),
        );
      }),
    );
  }

  /** Inserta el "claim". Devuelve la fila previa si ya existía, o 'EN_CURSO'. */
  async #reclamar(
    clave: string,
    usuarioId: string,
    endpoint: string,
  ): Promise<{ status_code: number | null; respuesta: unknown } | 'EN_CURSO' | null> {
    try {
      await this.prisma.idempotencia.create({
        data: { clave, usuario_id: usuarioId, endpoint },
      });
      return null;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const fila = await this.prisma.idempotencia.findUnique({
          where: { clave_usuario_id: { clave, usuario_id: usuarioId } },
        });
        if (fila && fila.respuesta !== null) {
          return { status_code: fila.status_code, respuesta: fila.respuesta };
        }
        return 'EN_CURSO';
      }
      throw e;
    }
  }

  async #guardar(
    clave: string,
    usuarioId: string,
    statusCode: number,
    body: unknown,
  ): Promise<void> {
    await this.prisma.idempotencia.update({
      where: { clave_usuario_id: { clave, usuario_id: usuarioId } },
      data: { status_code: statusCode, respuesta: (body ?? null) as Prisma.InputJsonValue },
    });
  }

  async #liberar(clave: string, usuarioId: string): Promise<void> {
    await this.prisma.idempotencia
      .delete({ where: { clave_usuario_id: { clave, usuario_id: usuarioId } } })
      .catch(() => undefined);
  }
}
