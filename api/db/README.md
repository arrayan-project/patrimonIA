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

`init/01_schema.sql` es una copia de `Docs/schema.sql` (traducción mecánica de
`DATABASE_DESIGN.docx`). Los scripts de `init/` los ejecuta el entrypoint de
Postgres **solo en el primer arranque**, cuando el volumen de datos está vacío.

Para reaplicar el esquema desde cero:

```bash
docker compose down -v && docker compose up -d
```

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
