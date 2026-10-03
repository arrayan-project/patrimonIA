#!/usr/bin/env bash
# Arranca Expo en modo RED LOCAL, apuntando al backend que corre en este PC
# (./scripts/api.sh). El teléfono tiene que estar en la misma WiFi que el PC.
# No hace falta tocar app/.env: la dirección que se pasa acá le gana a la de .env.
# Deja esta terminal abierta: acá aparece el QR.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

cd "$(dirname "$0")/../app"
nvm use             # lee .nvmrc → Node 22
node -v

ip=$(hostname -I | awk '{print $1}')
if [ -z "$ip" ]; then
  echo "✗ No encontré la IP de este PC en la red. ¿Está conectado a una WiFi?"
  exit 1
fi

if ! curl -s -m 3 "http://localhost:3000/health" >/dev/null; then
  echo "✗ El backend local no responde. Primero corre, en otras terminales:"
  echo "    ./scripts/db.sh"
  echo "    ./scripts/api.sh"
  exit 1
fi

# Metro suele usar el 8081; si quedó algo ocupándolo, lo cerramos.
viejo=$(lsof -ti :8081 2>/dev/null || true)
if [ -n "$viejo" ]; then
  echo "Puerto 8081 ocupado por el proceso $viejo — lo cierro."
  kill "$viejo" 2>/dev/null || true; sleep 1; kill -9 "$viejo" 2>/dev/null || true
fi

export EXPO_PUBLIC_API_URL="http://$ip:3000"
echo "→ Backend local: $EXPO_PUBLIC_API_URL"
echo "→ Si la app dice \"sin conexión\", abre esa dirección + /health en el"
echo "  navegador del teléfono. Si no carga, el problema es la red, no la app."
# --clear: que no quede guardada la dirección de la nube de un arranque anterior.
npm start -- --clear "$@"
