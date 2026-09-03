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
- [ ] Fase 0 — backend NestJS inicializado + healthcheck.
- [ ] Fase 0 — app Expo inicializada.
- [ ] Fase 1 — esqueleto vertical Flujo 2 (Alta de hogar): AS #34, #37, #38, #39, #43.
