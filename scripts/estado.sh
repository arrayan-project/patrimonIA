#!/usr/bin/env bash
# Diagnóstico rápido: ¿qué está andando y qué no?
set -uo pipefail

ip=$(hostname -I | awk '{print $1}')

echo "IP de este PC en la red:  $ip"
echo

db=$(docker inspect -f '{{.State.Health.Status}}' patrimonia-postgres 2>/dev/null || echo "no existe")
echo "Base de datos (Docker):   $db"

code=$(curl -sf -m3 -o /dev/null -w '%{http_code}' http://localhost:3000/health 2>/dev/null || echo DOWN)
echo "Backend  localhost:3000:   $code   (200 = ok)"

code_lan=$(curl -sf -m3 -o /dev/null -w '%{http_code}' "http://$ip:3000/health" 2>/dev/null || echo DOWN)
echo "Backend  $ip:3000:   $code_lan   (lo que ve el teléfono)"

metro=$(curl -sf -m3 -o /dev/null -w '%{http_code}' http://localhost:8081/status 2>/dev/null || echo DOWN)
echo "Expo/Metro localhost:8081: $metro   (200 = ok)"

echo
echo "Firewall (ufw):"
sudo -n ufw status 2>/dev/null | grep -E '3000|8081' || echo "  (no se pudo leer sin sudo — corre: sudo ufw status)"
