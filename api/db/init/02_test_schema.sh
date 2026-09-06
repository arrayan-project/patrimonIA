#!/bin/bash
# ============================================================================
# 02 — Aplica el MISMO esquema (01_schema.sql) a la base de test.
# ============================================================================
# El entrypoint de Postgres ya corrió 01_schema.sql contra la base principal
# ($POSTGRES_DB). Acá lo aplicamos también a patrimonia_test (creada en
# 00_test_db.sql). Sin duplicar el DDL.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname patrimonia_test \
  -f /docker-entrypoint-initdb.d/01_schema.sql

echo "✓ patrimonia_test lista (esquema aplicado)"
