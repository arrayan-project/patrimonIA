#!/usr/bin/env bash
# Arranca Expo (Metro) con la versión de Node correcta.
# Deja esta terminal abierta: acá aparece el QR para el teléfono.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/../app"
nvm use             # lee .nvmrc → Node 22
node -v

# Pasar --tunnel como argumento si el router aísla los dispositivos:
#   ./scripts/app.sh --tunnel
npm start -- "$@"
