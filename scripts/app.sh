#!/usr/bin/env bash
# Arranca Expo en modo TÚNEL — el teléfono se conecta desde cualquier red
# (datos móviles, otra WiFi), no hace falta estar en la misma que el PC.
# El backend y la base de datos están en la nube (Render + Neon), no acá.
# Deja esta terminal abierta: acá aparece el QR.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/../app"
nvm use             # lee .nvmrc → Node 22
node -v

# Metro suele usar el 8081; si quedó algo tuyo ocupándolo, lo cerramos.
viejo=$(lsof -ti :8081 2>/dev/null || true)
if [ -n "$viejo" ]; then
  echo "Puerto 8081 ocupado por el proceso $viejo — lo cierro."
  kill "$viejo" 2>/dev/null || true; sleep 1; kill -9 "$viejo" 2>/dev/null || true
fi

echo "→ Modo túnel. Esperá el QR (~15 s la primera vez)."
npm run start:tunnel -- "$@"
