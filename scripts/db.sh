#!/usr/bin/env bash
# Levanta la base de datos (PostgreSQL en Docker). Idempotente.
set -euo pipefail
cd "$(dirname "$0")/../api/db"

# El volumen es externo — si no existe, lo creamos (primera vez en esta máquina).
docker volume inspect patrimonia_pgdata >/dev/null 2>&1 || {
  echo "Creando el volumen de datos 'patrimonia_pgdata' (persiste entre reinicios)…"
  docker volume create patrimonia_pgdata >/dev/null
}

docker compose up -d
echo "Esperando a que Postgres esté listo..."
for _ in $(seq 1 30); do
  if [ "$(docker inspect -f '{{.State.Health.Status}}' patrimonia-postgres 2>/dev/null)" = "healthy" ]; then
    echo "✓ Base de datos lista en localhost:5432 (db=patrimonia, tests usan patrimonia_test)"
    vacia=$(docker exec patrimonia-postgres psql -U patrimonia -d patrimonia -tAc "SELECT count(*) FROM usuario" 2>/dev/null || echo "?")
    if [ "$vacia" = "0" ]; then
      echo "  La base está vacía. Para sembrar un escenario de prueba:"
      echo "    ./scripts/api.sh   (en otra terminal)  y luego  ./scripts/seed.sh"
    fi
    exit 0
  fi
  sleep 1
done
echo "✗ Postgres no llegó a 'healthy'. Revisa: docker logs patrimonia-postgres"
exit 1
