#!/usr/bin/env bash
# Renombrado a ./scripts/seed.sh (más corto de recordar). Este shim redirige.
exec "$(dirname "$0")/seed.sh" "$@"
