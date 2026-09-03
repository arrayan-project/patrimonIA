#!/usr/bin/env bash
# Arranca el backend (NestJS) con la versión de Node correcta.
# Deja esta terminal abierta: los logs se ven acá.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/../api"
nvm use             # lee .nvmrc → Node 22
node -v

# Si quedó un backend viejo ocupando el puerto 3000, lo cerramos.
puerto=3000
viejo=$(lsof -ti :"$puerto" 2>/dev/null || fuser "$puerto"/tcp 2>/dev/null | tr -d ' ' || true)
if [ -n "${viejo:-}" ]; then
  echo "Puerto $puerto ocupado por el proceso $viejo — lo cierro."
  kill "$viejo" 2>/dev/null || true
  sleep 1
  kill -9 "$viejo" 2>/dev/null || true
fi

npm run start:dev
