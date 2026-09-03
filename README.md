# PatrimonIA

Gestión de patrimonio familiar. Backend NestJS + PostgreSQL, cliente React Native (Expo).

Documentos de diseño (fuente de verdad): `Docs/` — leer en el orden de
`Docs/BUILD_INSTRUCTIONS.docx`.

## Estructura

Monorepo con dos paquetes independientes:

- `api/` — backend NestJS + PostgreSQL.
- `api/db/` — infraestructura de base de datos (Docker + esquema).
- `app/` — cliente Expo.

Se elige monorepo (y no dos repos) porque el contrato TypeScript se comparte
end-to-end (nombres de comando, tipos de payload) y la trazabilidad
DDD → Application Services → API → código es más fácil de mantener en un solo
árbol. Los paquetes se despliegan por separado.

## Estado de construcción

Se construye vertical (un flujo completo end-to-end a la vez), no horizontal.

- [x] **Fase 0 — DB**: esquema PostgreSQL ejecutado y verificado en Docker
  (`postgres:16`). Ver `api/db/README.md`.
- [x] **Fase 0 — backend**: NestJS 12 + Prisma 7 sobre PostgreSQL. `GET /health`
  responde 200 con ping real a la DB. Ver `api/README.md`.
- [x] **Fase 0 — app**: Expo SDK 57 + TypeScript, pantalla en blanco. Ver `app/README.md`.
- [x] **Fase 1 — esqueleto vertical Flujo 2 (Alta de hogar)**:
  - [x] Backend: AS #43 RegistrarUsuario, #34 CrearHogar, #37 InvitarMiembro,
    #38 AceptarInvitacion, #39 RechazarInvitacion. Auditoría en la misma
    transacción desde el primer comando. Auth JWT. e2e en verde.
  - [x] Móvil: pantallas Registro / Bienvenida / Crear Hogar / Invitaciones /
    Dashboard. `tsc` + `expo export` limpios; render confirmado en web.
- [ ] Fase 2 — se define al cerrar Fase 1 (BUILD_INSTRUCTIONS §3).

Vacíos y decisiones pendientes: ver `GAPS.md`.

## Requisitos de entorno

- Node 22 (`.nvmrc` en `api/` y `app/`) — el toolchain (NestJS 12, Expo 57) lo exige.
- Docker (para PostgreSQL local, no requiere Postgres instalado).
