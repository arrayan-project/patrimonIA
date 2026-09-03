#!/usr/bin/env bash
# Levanta la base de datos (PostgreSQL en Docker). Idempotente.
set -euo pipefail
cd "$(dirname "$0")/../api/db"

docker compose up -d
echo "Esperando a que Postgres esté listo..."
for _ in $(seq 1 30); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' patrimonia-postgres 2>/dev/null)" = "healthy" ]; then
    echo "✓ Base de datos lista en localhost:5432 (db=patrimonia user=patrimonia)"
    exit 0
  fi
  sleep 1
done
echo "✗ Postgres no llegó a 'healthy'. Revisa: docker logs patrimonia-postgres"
exit 1
