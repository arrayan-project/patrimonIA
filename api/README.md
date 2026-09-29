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

## Tests

```
npm test          # unitarios (src/**/*.spec.ts) — sin DB
npm run test:e2e  # end-to-end (test/**/*.e2e-spec.ts) — requiere Postgres arriba
npm run test:all  # ambos
```

CI en `.github/workflows/ci.yml`: levanta `postgres:16` de servicio, carga
`db/init/01_schema.sql`, y corre lint + build + unitarios + e2e (y en la app,
`tsc` + `expo export`).

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
`@Public()`: `GET /health`, `POST /auth/login`, `POST /auth/registro-token`,
`POST /auth/verificar-codigo-registro`, `POST /comandos/RegistrarUsuario` (ver
GAPS.md G4), y
`POST /auth/solicitar-reset-password` / `POST /auth/reset-password` (GAPS.md
G31). Registro y reset envían por email un código de 6 dígitos (15 min, 5
intentos, tabla `codigo_verificacion`). El token se obtiene con `POST /auth/login` (email + password). El guard
rechaza los tokens de propósito acotado (registro/reset) y las sesiones emitidas
antes de un reset de contraseña (`usuario.token_version`). La autorización por
rol vive dentro de cada Application Service, no en el guard.

Emails (token de registro, reset de contraseña): `BrevoEmailSender` si hay
`BREVO_API_KEY` + `EMAIL_REMITENTE`; si no, `ConsoleEmailSender` (solo log).
Ver `../Docs/DESPLIEGUE.md` §2b.

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
  ajuste-patrimonial/  AS #20 Registrar · #21 Anular · #22 Corregir
  planificacion/       Objetivo (#30-33) · Asignación (#23-26) · Reserva (#27-29)
                       + progreso_objetivo + políticas "Completar objetivo" /
                       "Consumir reserva"
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
  sobre cualquier valorización vigente sin corrección viva; si no es la última,
  la siguiente absorbe la diferencia con un impacto compensatorio y
  `valor_vigente` no cambia (GAPS.md G11). Corregir **reemplaza** el valor
  (stock, no flujo). Motivo obligatorio.
- `GET /elementos-patrimoniales/:id/valorizaciones` — historial.
- Verificado: `test/flujo3-valorizacion.e2e-spec.ts`.

### Fase 5a — Ajuste Patrimonial (mecanismo de excepción)

- `POST /comandos/RegistrarAjustePatrimonial` (#20) — monto con signo, motivo
  obligatorio; genera impacto = monto. `AnularAjustePatrimonial` (#21) revierte.
  `CorregirAjustePatrimonial` (#22) compensa montos (flujo), como Evento.
- `GET /ajustes-patrimoniales?elemento=:id`.
- Verificado: `test/ajuste-patrimonial.e2e-spec.ts`.

### Fase 5b — comandos de ciclo de vida y edición

- Elemento: `ActualizarDatos` (#2), `CorregirDatos` (#3), `CambiarVisibilidad`
  (#5), `CambiarParticipacionEnConsolidacion` (#6), `Desactivar` (#7),
  `Reactivar` (#8), `Eliminar` (#9), `CambiarPropiedad` (#4).
  `GET /elementos-patrimoniales?propietario=me&incluirInactivos=true`.
- Hogar: `ActualizarDatosHogar` (#35), `CambiarMonedaConsolidacion` (#36),
  `AsignarRol` (#40), `RemoverMiembro` (#41), `SalirDeHogar` (#45),
  `EliminarHogar` (#42). Invariante "≥1 administrador" validado en el AS.
- Usuario: `ActualizarDatosUsuario` (#44), `DesactivarUsuario` (#46).
- Verificado: `test/fase5b-ciclo-vida.e2e-spec.ts`. Ver GAPS.md G12.

### Fase 5c — Flujo 5 (objetivo + asignación + reserva)

- Objetivo: `Crear` (#30), `ActualizarDatos` (#31), `CambiarEstado` (#32),
  `Eliminar` (#33). `GET /objetivos-financieros[?estado=]`, `/:id` (con progreso).
- Asignación: `Crear` (#23), `ActualizarDatos` (#24), `CambiarAsociacionAObjetivo`
  (#25), `Eliminar` (#26, cascada de reservas). `GET /asignaciones[?objetivo=]`,
  `/:id`, `/:id/reservas`.
- Reserva: `Crear` (#27, valida disponibilidad), `AjustarMonto` (#28),
  `Liberar` (#29).
- Proyección `progreso_objetivo` = Σ reservas ACTIVAS de sus asignaciones.
- Política **Completar objetivo** (auto, fila de auditoría encadenada) y
  **Consumir reserva** (`asignacionId` en RegistrarEventoFinanciero).
- Requiere migración `db/migrations/001_...sql` (columna `usuario_id`, GAPS.md G13).
- Verificado: `test/flujo5-objetivo-reserva.e2e-spec.ts`. Ver GAPS.md G14.

Cada comando escribe su entrada de `auditoria` en la misma transacción.

Las fases 6 en adelante (presupuesto, movimientos programados, deuda/crédito,
reconstrucción histórica, consolidación, notificaciones, multimoneda, reportes,
categorías, etiquetas, etc.) están en el changelog del `../README.md`
("Estado de construcción" → Implementado). Lo pendiente vive en `../GAPS.md`
Parte 1.
