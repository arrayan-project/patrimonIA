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

npm run start:dev
