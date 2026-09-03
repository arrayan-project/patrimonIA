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
- [x] **Fase 2 — Flujo 1 (día a día financiero)**:
  - [x] Backend: AS #1 RegistrarElementoPatrimonial, #10 RegistrarEventoFinanciero
    (INGRESO/GASTO/TRANSFERENCIA) + impacto_patrimonial + valor_vigente +
    proyección patrimonio_individual. e2e en verde.
  - [x] Móvil: Dashboard con patrimonio + elementos, Agregar elemento, Registrar
    movimiento, Detalle de elemento.
- [ ] Fase 3 — se define al cerrar Fase 2 (BUILD_INSTRUCTIONS §3).

Vacíos y decisiones pendientes: ver `GAPS.md`.

## Requisitos de entorno

- **Node 22.12+** — el toolchain (NestJS 12, Prisma 7, Expo 57) lo exige. Con
  Node 20 el backend arranca y muere sin escuchar nada. En cada carpeta
  (`api/`, `app/`) corre `nvm use` antes de `npm ...`; los scripts `start`
  abortan con un mensaje si detectan una versión vieja. Verifica con `node -v`.
- Docker (para PostgreSQL local, no requiere Postgres instalado).

## Probar en el teléfono (Expo Go)

1. `nvm use` + `npm run start:dev` en `api/` — verifica `curl localhost:3000/health`.
2. `nvm use` + `npm start` en `app/` — muestra un QR.
3. Teléfono en la **misma WiFi**. Firewall: `sudo ufw allow 3000/tcp` y
   `sudo ufw allow 8081/tcp` (ufw viene activo).
4. Prueba desde el navegador del teléfono: `http://<IP-del-PC>:3000/health` →
   JSON. Si eso carga, la app también.
5. Escanea el QR: Android desde Expo Go; iPhone con la cámara.
6. Si el router aísla los dispositivos: `npm start -- --tunnel` en `app/`.

No hay usuario de prueba: la cuenta se crea en la pantalla "Crear cuenta".
