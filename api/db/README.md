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
