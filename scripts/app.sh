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

# Metro SIEMPRE en el 8081 (el puerto que abriste en el firewall). Si quedó algo
# ocupándolo, lo cerramos para no terminar en el 8082 (bloqueado por ufw).
puerto=8081
viejo=$(lsof -ti :"$puerto" 2>/dev/null || true)
if [ -n "$viejo" ]; then
  echo "Puerto $puerto ocupado por el proceso $viejo — lo cierro."
  kill "$viejo" 2>/dev/null || true
  sleep 1
  kill -9 "$viejo" 2>/dev/null || true
fi

# Pasar --tunnel como argumento si el router aísla los dispositivos
# (redes de campus/hotel, IPs 10.x):  ./scripts/app.sh --tunnel
npm start -- --port "$puerto" "$@"
