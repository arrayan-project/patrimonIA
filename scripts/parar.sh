#!/usr/bin/env bash
# Cierra el backend y Expo/Metro si quedaron corriendo en segundo plano.
# La base de datos (Docker) se deja andando — se apaga sola al reiniciar.
set -uo pipefail

matar_puerto() {
  local puerto=$1 nombre=$2
  local pids
  pids=$(lsof -ti :"$puerto" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "Cerrando $nombre (puerto $puerto): $pids"
    kill $pids 2>/dev/null || true
    sleep 1
    kill -9 $pids 2>/dev/null || true
  else
    echo "$nombre (puerto $puerto): nada corriendo"
  fi
}

matar_puerto 3000 "backend"
matar_puerto 8081 "Expo/Metro"
pkill -f "nest start" 2>/dev/null || true
pkill -f "expo start" 2>/dev/null || true

echo "Listo. Para volver a arrancar: ./scripts/api.sh  y  ./scripts/app.sh"
