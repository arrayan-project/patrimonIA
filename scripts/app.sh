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

# Metro suele usar el 8081; si está ocupado por algo tuyo, lo cerramos. Si aun
# así Expo cae al 8082, abre el rango en el firewall UNA vez:
#     sudo ufw allow 8081:8090/tcp
for puerto in 8081; do
  viejo=$(lsof -ti :"$puerto" 2>/dev/null || true)
  if [ -n "$viejo" ]; then
    echo "Puerto $puerto ocupado por el proceso $viejo — lo cierro."
    kill "$viejo" 2>/dev/null || true; sleep 1; kill -9 "$viejo" 2>/dev/null || true
  fi
done

# En redes que aíslan los dispositivos (campus / oficina / hotel) el teléfono no
# puede ver al PC; usa el emulador Android (tecla `a`) o prueba en otra WiFi.
npm start -- "$@"
