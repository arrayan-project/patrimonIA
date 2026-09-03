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
- [x] **Fase 3 — Flujo 6 (corregir / anular un movimiento)**:
  - [x] Backend: AS #11 AnularEventoFinanciero, #12 CorregirEventoFinanciero
    (patrón de corrección). e2e en verde.
  - [x] Móvil: detalle de movimiento con acciones Corregir / Anular; en el
    detalle de elemento los anulados van tachados y las correcciones etiquetadas.
- [x] **Fase 4 — Flujo 3 (activo no líquido + valorización)**:
  - [x] Backend: AS #17 RegistrarValorizacion, #18 AnularValorizacion,
    #19 CorregirValorizacion. e2e en verde.
  - [x] Móvil: toggle "se valoriza" al crear el elemento; sección Valorizaciones
    en el detalle con Registrar / Corregir / Anular.
- [x] **Fase 5** (backend + app, e2e en verde):
  - [x] **5a** — Ajuste Patrimonial (AS #20/#21/#22). Cierra el trío del patrón
    de corrección (Evento, Valorización, Ajuste).
  - [x] **5b** — comandos de ciclo de vida: Elemento (#2-#9), Hogar
    (#35/#36/#40/#41/#42/#45), Usuario (#44/#46).
  - [x] **5c** — Flujo 5: Objetivo (#30-#33) + Asignación (#23-#26) + Reserva
    (#27-#29) + proyección progreso + políticas "Completar objetivo" /
    "Consumir reserva". Migración 001 (columna `usuario_id`).
- [x] **Fase 6 — Presupuesto (Agregado K, AS #49–#52)**:
  - [x] Backend: CrearPresupuesto, ActualizarDatosPresupuesto, CerrarPresupuesto
    (solo específicos), EliminarPresupuesto + proyección `desviacion_presupuestaria`
    (presupuestado vs. real, en vivo). Migración 002 (`usuario_id` / `hogar_id`).
    e2e en verde.
  - [x] Móvil: pantalla Presupuestos (lista + alta) y detalle con la
    comparación presupuestado-vs-real y acciones Editar / Cerrar / Eliminar.
- [ ] Fase 7 — se define al cerrar Fase 6 (BUILD_INSTRUCTIONS §3).

**Cobertura de los 52 Application Services**: 46 implementados (#1–#12, #17–#46,
#49–#52). Faltan 6: Movimiento Programado (#13–#16), Deuda/Crédito (#47/#48).

Vacíos y decisiones pendientes: ver `GAPS.md`.

## Requisitos de entorno

- **Node 22.12+** — el toolchain (NestJS 12, Prisma 7, Expo 57) lo exige. Con
  Node 20 el backend arranca y muere sin escuchar nada. En cada carpeta
  (`api/`, `app/`) corre `nvm use` antes de `npm ...`; los scripts `start`
  abortan con un mensaje si detectan una versión vieja. Verifica con `node -v`.
- Docker (para PostgreSQL local, no requiere Postgres instalado).

## Probar en el teléfono

**Guía completa (arrancar desde cero, tras reiniciar el laptop):
[`Docs/CORRER_EN_LOCAL.md`](Docs/CORRER_EN_LOCAL.md)**

Resumen — dos terminales:
```bash
./scripts/db.sh && ./scripts/api.sh   # terminal 1: base de datos + backend
./scripts/app.sh                      # terminal 2: Expo (muestra el QR)
./scripts/estado.sh                   # diagnóstico: ¿qué está andando?
```
Los scripts eligen Node 22 solos. Firewall (una vez): `sudo ufw allow 3000/tcp`
y `sudo ufw allow 8081/tcp`. No hay usuario de prueba: se crea en "Crear cuenta".
