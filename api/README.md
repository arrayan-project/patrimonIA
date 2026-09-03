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
  elemento/            AS #1 RegistrarElementoPatrimonial + consultas
  evento-financiero/   AS #10 Registrar · #11 Anular · #12 Corregir
  valorizacion/        AS #17 Registrar · #18 Anular · #19 Corregir
  proyecciones/        GET /usuarios/me/patrimonio-individual (cálculo en vivo)
```

Convención de auditoría: `comando` en PascalCase (`RegistrarEventoFinanciero`),
`entidad_tipo` / `entidad_relacionada_tipo` en SCREAMING_SNAKE
(`ELEMENTO_PATRIMONIAL`, `EVENTO_FINANCIERO`, `HOGAR`…) — DATABASE_DESIGN §11/U.

### Fase 1 — Flujo 2 (Alta de hogar)

`RegistrarUsuario`, `CrearHogar`, `InvitarMiembro`, `AceptarInvitacion`,
`RechazarInvitacion`. Verificado: `test/flujo2-alta-hogar.e2e-spec.ts`.

### Fase 2 — Flujo 1 (día a día financiero)

- `POST /comandos/RegistrarElementoPatrimonial` (#1) — categorías LIQUIDEZ /
  RESERVA / INVERSION / ACTIVO; propietarios[] con % (suma 100).
- `POST /comandos/RegistrarEventoFinanciero` (#10) — INGRESO / GASTO /
  TRANSFERENCIA. Genera `impacto_patrimonial`, actualiza `valor_vigente`
  (desnormalizado), todo en una transacción con su auditoría.
- Consultas: `GET /elementos-patrimoniales[?propietario=me]`,
  `/elementos-patrimoniales/:id[/impactos]`, `/eventos-financieros?elemento=:id`,
  `/eventos-financieros/:id`, `/usuarios/me/patrimonio-individual`.
- Verificado: `test/flujo1-dia-a-dia.e2e-spec.ts`.

### Fase 3 — Flujo 6 (corregir / anular un movimiento)

- `POST /comandos/AnularEventoFinanciero` (#11) — revierte el efecto sobre
  `valor_vigente` y marca `anulado` (única mutación permitida). Motivo obligatorio.
- `POST /comandos/CorregirEventoFinanciero` (#12) — **patrón de corrección**
  (DDD Sección T): el original queda intacto, se inserta un evento compensatorio
  con `correccion_de_id` y un impacto = signo del impacto original × (nuevo − viejo).
  Fase 3 corrige solo el monto. Motivo obligatorio.
- Verificado: `test/flujo6-correccion.e2e-spec.ts`.

### Fase 4 — Flujo 3 (activo no líquido + valorización)

- `POST /comandos/RegistrarValorizacion` (#17) — reemplaza `valor_vigente` (no
  acumula), genera impacto = nuevo − anterior. Exige `admite_valorizacion`.
- `POST /comandos/AnularValorizacion` (#18) / `CorregirValorizacion` (#19) —
  solo sobre la última valorización vigente del elemento. Corregir **reemplaza**
  el valor (stock, no flujo). Motivo obligatorio.
- `GET /elementos-patrimoniales/:id/valorizaciones` — historial.
- Verificado: `test/flujo3-valorizacion.e2e-spec.ts`.

Cada comando escribe su entrada de `auditoria` en la misma transacción. El resto
de los 52 Application Services entra en fases siguientes, un flujo vertical a la
vez. Ver `Docs/BUILD_INSTRUCTIONS.docx` y `../GAPS.md`.
