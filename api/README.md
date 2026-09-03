# PatrimonIA — API

Backend NestJS (ESM, NestJS 12). PostgreSQL vía Prisma.

## Puesta en marcha

```bash
# 1. Levantar la base de datos (desde api/db/)
cd db && docker compose up -d && cd ..

# 2. Configurar entorno
cp .env.example .env

# 3. Instalar y generar el cliente Prisma
npm install
npm run prisma:generate

# 4. Arrancar en desarrollo
npm run start:dev
```

## Healthcheck

```
GET http://localhost:3000/health
```

Devuelve `200` con `{ "status": "ok", ... }` cuando el proceso responde y la
conexión a PostgreSQL está viva (`@nestjs/terminus` + `PrismaHealthIndicator`).

## Prisma

- `prisma/schema.prisma` se genera por introspección de la DB real
  (`npm run prisma:pull`) — el esquema SQL en `db/init/01_schema.sql` es la
  fuente de verdad de la estructura en Fase 0. Prisma no gestiona migraciones
  todavía.
- `npm run prisma:generate` regenera el cliente tipado tras cada `pull`.

## Autenticación

Todo endpoint exige `Authorization: Bearer <jwt>` (API_DESIGN), salvo los
`@Public()`: `GET /health`, `POST /auth/login`, `POST /comandos/RegistrarUsuario`
(ver GAPS.md G4). El token se obtiene con `POST /auth/login` (email + password).
La autorización por rol vive dentro de cada Application Service, no en el guard.

## Estructura

```
src/
  main.ts              arranque, CORS, shutdown hooks, ValidationPipe global
  app.module.ts        composición raíz
  prisma/              PrismaService (cliente inyectable, @Global)
  auth/                JWT, JwtAuthGuard global, @Public(), @CurrentUser()
  auditoria/           AuditoriaService — escribe la entrada DENTRO de la
                       transacción de cada comando (DDD Sección U)
  health/              healthcheck
  usuario/             AS #43 RegistrarUsuario · GET /usuarios/me
  hogar/               AS #34 CrearHogar · #37 InvitarMiembro ·
                       #38 AceptarInvitacion · #39 RechazarInvitacion
                       + consultas de hogar/miembros/invitaciones
```

### Fase 1 — Flujo 2 (Alta de hogar)

Comandos (`POST /comandos/{Nombre}`, nombres literales del dominio):
`RegistrarUsuario`, `CrearHogar`, `InvitarMiembro`, `AceptarInvitacion`,
`RechazarInvitacion`. Cada comando escribe su entrada de `auditoria` en la misma
transacción. Verificado end-to-end: `test/flujo2-alta-hogar.e2e-spec.ts`.

El resto de los 52 Application Services entra en fases siguientes, un flujo
vertical a la vez. Ver `Docs/BUILD_INSTRUCTIONS.docx` y `../GAPS.md`.
