# Base de datos — PatrimonIA

PostgreSQL 16 en Docker. No requiere Postgres instalado localmente.

## Arrancar

```bash
cd api/db
docker compose up -d
```

El contenedor expone `localhost:5432`. Credenciales (solo desarrollo local):

```
host=localhost port=5432 db=patrimonia user=patrimonia password=patrimonia
```

## Esquema

`init/01_schema.sql` parte de `Docs/schema.sql` (traducción de
`DATABASE_DESIGN.docx`) más los cambios de las migraciones ya aplicadas. Los
scripts de `init/` los ejecuta el entrypoint de Postgres **solo en el primer
arranque**, cuando el volumen de datos está vacío.

Para reaplicar el esquema desde cero (DB nueva, ya trae todo):

```bash
docker compose down -v && docker compose up -d
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
