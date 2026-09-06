#!/usr/bin/env bash
# ============================================================================
# Restaura un dump hecho con ./scripts/backup.sh sobre la base local.
# ============================================================================
#   ./scripts/restore.sh backups/patrimonia_20260906_120000.sql.gz
# El dump lleva --clean --if-exists: reemplaza el contenido actual de patrimonia.
set -euo pipefail

f="${1:-}"
if [ -z "$f" ] || [ ! -f "$f" ]; then
  echo "Uso: ./scripts/restore.sh <archivo.sql.gz>" >&2
  echo "Disponibles:" >&2
  ls -1t "$(dirname "$0")/../backups"/*.sql.gz 2>/dev/null | sed 's/^/  /' >&2 || echo "  (ninguno)" >&2
  exit 1
fi

read -rp "Esto REEMPLAZA el contenido de la base 'patrimonia' con $f. ¿Seguir? [y/N] " ok
[ "$ok" = y ] || { echo "Cancelado."; exit 0; }

gunzip -c "$f" | docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia -v ON_ERROR_STOP=1 >/dev/null
echo "✓ Restaurado desde $f"
