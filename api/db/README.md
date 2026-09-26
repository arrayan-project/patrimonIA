# Base de datos — PatrimonIA

PostgreSQL 16 en Docker. No requiere Postgres instalado localmente.

## Arrancar

```bash
./scripts/db.sh          # crea el volumen si falta, levanta Postgres, avisa si está vacía
# o a mano:
docker volume create patrimonia_pgdata   # solo la primera vez en esta máquina
cd api/db && docker compose up -d
```

El contenedor expone `localhost:5432`. Credenciales (solo desarrollo local):

```
host=localhost port=5432 db=patrimonia user=patrimonia password=patrimonia
```

## Dos bases: `patrimonia` y `patrimonia_test`

| Base | Para qué | Quién la borra |
|------|----------|----------------|
| **`patrimonia`** | Tus datos de desarrollo / lo que pruebas en el teléfono. | Solo `./scripts/seed.sh` o un `restore`. |
| **`patrimonia_test`** | Los e2e (`npm run test:e2e`). Hacen `TRUNCATE` en cada `beforeAll`. | Los propios tests, todo el tiempo. |

Los e2e leen `api/.env.test` (versionado, sin secretos) y **nunca** tocan
`patrimonia`. Antes de este cambio los tests corrían contra `patrimonia` y por
eso "desaparecían" los datos que creabas a mano.

## Persistencia

El volumen `patrimonia_pgdata` es **externo** (se crea una vez con
`docker volume create patrimonia_pgdata`). `docker compose down -v` **no lo
borra** — hay que ser explícito: `docker volume rm patrimonia_pgdata`.

- Sobrevive reinicios del laptop (`restart: unless-stopped` + Docker arranca en
  boot).
- Para **empezar de cero** con datos: `./scripts/seed.sh` (no `down -v`).
- Backup puntual antes de algo riesgoso: `./scripts/backup.sh` / `./scripts/restore.sh`.

## Esquema

`init/01_schema.sql` parte de `Docs/_baseline/schema.sql` (traducción Fase 0 de
`DATABASE_DESIGN.md`) más los cambios de las migraciones ya aplicadas. Es **la
fuente ejecutable**; `DATABASE_DESIGN.md` §13 documenta los mismos cambios en prosa. Los
scripts de `init/` los ejecuta el entrypoint de Postgres **solo en el primer
arranque**, cuando el volumen de datos está vacío.

Para reaplicar el esquema desde cero **borrando el volumen** (raro — normalmente
`./scripts/seed.sh` basta):

```bash
cd api/db && docker compose down && docker volume rm patrimonia_pgdata
docker volume create patrimonia_pgdata && docker compose up -d
```

### Migraciones (`migrations/`)

Cambios incrementales para DBs **existentes**. Aplicar en orden:

```bash
for f in migrations/*.sql; do
  docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia < "$f"
done
# luego regenerar el cliente Prisma:
cd .. && npm run prisma:pull && npm run prisma:generate
```

- `001_objetivo_asignacion_propietario.sql` — columna `usuario_id` en
  `objetivo_financiero` y `asignacion` (GAPS.md G13). Ya incluida en
  `init/01_schema.sql`.
- `002_presupuesto_propietario.sql` — columnas `usuario_id` / `hogar_id` +
  CHECK `ck_presupuesto_propietario` en `presupuesto` (GAPS.md G15). Ya incluida
  en `init/01_schema.sql`.
- `003_impacto_origen_condonacion.sql` — amplía el CHECK de
  `impacto_patrimonial.origen_tipo` con `CONDONACION` / `DECLARACION_INCOBRABLE`
  (GAPS.md G17). Ya incluida en `init/01_schema.sql`.
- `004_impacto_fecha.sql` — columna `fecha` (fecha del hecho económico origen)
  en `impacto_patrimonial`, para la reconstrucción histórica (DDD §V, GAPS.md
  G18). Backfill desde los orígenes. Ya incluida en `init/01_schema.sql`.
- `005_notificacion.sql` — tabla `notificacion` (infraestructura in-app del
  Principio 4, GAPS.md G20). Ya incluida en `init/01_schema.sql`.
- `006_idempotencia.sql` — tabla `idempotencia` (header `Idempotency-Key`,
  API_DESIGN §43). Ya incluida en `init/01_schema.sql`.
- `007_tipo_cambio.sql` — tabla `tipo_cambio` (dato de referencia global,
  inmutable — REQUISITES §514–532, GAPS.md G21). Ya incluida en
  `init/01_schema.sql`.
- `008_dispositivo_push.sql` — tabla `dispositivo_push` (Expo push tokens,
  GAPS.md G20). Ya incluida en `init/01_schema.sql`.
- `009_categoria_movimiento.sql` — tabla `categoria_movimiento` (del hogar) +
  `evento_financiero.glosa` + `evento_financiero.categoria_id` (GAPS.md
  G22/G23). Ya incluida en `init/01_schema.sql`.
- `010_presupuesto_linea.sql` — tabla `presupuesto_linea` (monto esperado por
  categoría dentro de un presupuesto — presupuesto por rubro, GAPS.md G26). Ya
  incluida en `init/01_schema.sql`.
- `011_plantilla_movimiento.sql` — tabla `plantilla_movimiento` (molde personal
  y sin fecha para movimientos recurrentes, GAPS.md G24). Ya incluida en
  `init/01_schema.sql`.
- `012_etiqueta.sql` — tablas `etiqueta` (personal) y `evento_etiqueta` (N:M,
  `ON DELETE CASCADE`) — clasificación transversal de movimientos (GAPS.md G23).
  Ya incluida en `init/01_schema.sql`.
- `013_agrupacion_elemento.sql` — tablas `agrupacion_elemento` (personal) y
  `agrupacion_miembro` (`elemento_id` único → una carpeta por elemento) —
  carpetas de visualización (GAPS.md G23). Ya incluida en `init/01_schema.sql`.
- `014_detalle_deuda_credito.sql` — columnas opcionales en `elemento_patrimonial`
  para DEUDA/CREDITO: `contraparte`, `fecha_inicio`, `fecha_termino`,
  `cuota_monto`, `tasa_interes`, `observaciones` (REQUISITES §J) +
  `valor_pendiente_inicial` para derivar el estado operativo (GAPS.md G1).
  Ya incluida en `init/01_schema.sql`.
- `015_movimiento_programado_tipo.sql` — `tipo` (INGRESO/GASTO/TRANSFERENCIA) +
  `elemento_origen_id` en `movimiento_programado`; `elemento_destino_id` pasa a
  nullable; CHECK `ck_mov_prog_elementos` amarra los slots al tipo (GAPS.md G2,
  DOMINIO_PENDIENTE §B5). Ya incluida en `init/01_schema.sql`.
- `016_visibilidad_granular.sql` — `elemento_visibilidad` (nivel por tipo de
  información: EXISTENCIA/VALOR/MOVIMIENTOS) + `elemento_comparticion` (con quién
  se comparte cuando el nivel es COMPARTIDA). GAPS.md G6, DOMINIO_PENDIENTE §B1.
  Ya incluida en `init/01_schema.sql`.
- `017_categoria_jerarquica.sql` — `categoria_movimiento.categoria_padre_id`
  (2 niveles, GAPS.md P7/B9). Ojo: `prisma db pull` borra la relación
  evento_financiero⇄categoria_movimiento — `npm run prisma:pull` la re-agrega
  con `scripts/fix-schema-relations.mjs`. Ya incluida en `init/01_schema.sql`.
- `018_tipo_elemento.sql` — catálogo `tipo_elemento` por hogar + backfill
  (GAPS.md P?, Fase 40). Ya incluida en `init/01_schema.sql`.
- `019_presupuesto_linea_ahorro.sql` — línea de ahorro esperado por objetivo
  (GAPS.md P6). Ya incluida en `init/01_schema.sql`.
- `020_elemento_fecha_alta_baja.sql` — `fecha_alta` / `fecha_baja` del elemento
  para la reconstrucción histórica (GAPS.md P10/B10). Ya incluida.
- `021_objetivo_hogar_designados.sql` — `objetivo_financiero.hogar_id` + tabla
  `objetivo_designado` (objetivos compartidos por hogar, GAPS.md P9/B6). Ya incluida.
- `022_moneda_planificacion.sql` — `moneda` (etiqueta, sin conversión) en
  objetivo / asignación / presupuesto (GAPS.md P11/B8). Ya incluida.
- `023_elemento_naturaleza.sql` — `elemento_patrimonial.naturaleza`
  (`FINANCIERA` | `CUSTODIA_INFORMAL`) + 2 CHECK. NOT NULL para DEUDA/CREDITO
  (default `FINANCIERA`), NULL en el resto. Distingue una deuda/crédito real de
  la plata que solo pasa por las cuentas (encargo de un tercero). GAPS.md G28,
  DDD.md §X.2, DATABASE_DESIGN.md §13. Ya incluida en `init/01_schema.sql`.
- `024_evento_saldo_inicial.sql` — amplía el CHECK de `evento_financiero.tipo`
  con `SALDO_INICIAL`. `RegistrarElementoPatrimonial`, para LIQUIDEZ/RESERVA con
  valorInicial > 0, crea también un evento SALDO_INICIAL + impacto (fecha =
  fecha_alta) para que la apertura de la cuenta cuente como ingreso del mes en el
  reporte financiero. No requiere `prisma:pull` (`tipo` sigue TEXT). GAPS.md G29.
- `025_usuario_token_version.sql` — columna `token_version` en `usuario`. Se
  incrementa al resetear la contraseña: invalida las sesiones previas y el token
  de reset ya usado. Ya incluida en `init/01_schema.sql`. GAPS.md G31.
  Ya incluida en `init/01_schema.sql`.

## Estado

- Fase 0 — esquema completo (16 tablas) ejecutado y verificado contra `postgres:16`.
  Corre limpio, sin errores. CHECKs, índices únicos parciales y FKs validados con
  inserts de prueba.
- Migraciones formales (Prisma) se incorporan al inicializar el proyecto NestJS
  en `api/`. Hasta entonces este SQL es la única fuente de estructura.

## Verificación rápida

```bash
docker exec patrimonia-postgres psql -U patrimonia -d patrimonia -c "\dt"
```
