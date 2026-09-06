#!/usr/bin/env bash
# ============================================================================
# Dump comprimido de la base local (patrimonia) → scripts/../backups/
# ============================================================================
# Úsalo antes de algo que dé miedo (una migración grande, probar un comando
# destructivo). NO es la estrategia principal — para eso está ./scripts/seed.sh.
# Restaurar:  ./scripts/restore.sh backups/<archivo>.sql.gz
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p backups
out="backups/patrimonia_$(date +%Y%m%d_%H%M%S).sql.gz"

docker exec patrimonia-postgres pg_dump -U patrimonia --no-owner --clean --if-exists patrimonia \
  | gzip > "$out"

echo "✓ Backup: $out  ($(du -h "$out" | cut -f1))"
ls -1t backups/*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -- && echo "  (se conservan los 10 más recientes)"
