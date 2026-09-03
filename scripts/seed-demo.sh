#!/usr/bin/env bash
# Resetea la base y siembra un escenario de demostración.
# Requiere el backend corriendo (./scripts/api.sh).
set -euo pipefail
B="${1:-http://localhost:3000}"
H='content-type: application/json'

py() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

docker exec patrimonia-postgres psql -U patrimonia -d patrimonia -c \
  "TRUNCATE auditoria, membresia, invitacion, hogar, usuario, elemento_patrimonial, elemento_propietario, evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial, objetivo_financiero, asignacion, reserva RESTART IDENTITY CASCADE" >/dev/null

curl -s -XPOST "$B/comandos/RegistrarUsuario" -H "$H" \
  -d '{"email":"demo@patrimonia.cl","nombre":"Demo","password":"demo1234"}' >/dev/null
T=$(curl -s -XPOST "$B/auth/login" -H "$H" -d '{"email":"demo@patrimonia.cl","password":"demo1234"}' | py '["accessToken"]')
A="authorization: Bearer $T"

curl -s -XPOST "$B/comandos/CrearHogar" -H "$A" -H "$H" -d '{"nombre":"Casa Demo"}' >/dev/null

CC=$(curl -s -XPOST "$B/comandos/RegistrarElementoPatrimonial" -H "$A" -H "$H" \
  -d '{"nombre":"Cuenta Corriente","tipo":"cuenta_corriente","categoriaFuncional":"LIQUIDEZ","valorInicial":800000,"moneda":"CLP","participaValorLiquido":true}' | py '["id"]')
G=$(curl -s -XPOST "$B/comandos/RegistrarEventoFinanciero" -H "$A" -H "$H" \
  -d "{\"tipo\":\"GASTO\",\"monto\":50000,\"moneda\":\"CLP\",\"elementoOrigenId\":\"$CC\"}" | py '["id"]')
curl -s -XPOST "$B/comandos/CorregirEventoFinanciero" -H "$A" -H "$H" \
  -d "{\"eventoId\":\"$G\",\"nuevoMonto\":45000,\"motivo\":\"el monto real era 45 mil\"}" >/dev/null

DEP=$(curl -s -XPOST "$B/comandos/RegistrarElementoPatrimonial" -H "$A" -H "$H" \
  -d '{"nombre":"Departamento","tipo":"inmueble","categoriaFuncional":"ACTIVO","valorInicial":95000000,"moneda":"CLP","admiteValorizacion":true,"participaConsolidacion":true}' | py '["id"]')
curl -s -XPOST "$B/comandos/RegistrarValorizacion" -H "$A" -H "$H" \
  -d "{\"elementoId\":\"$DEP\",\"valorNuevo\":110000000}" >/dev/null

FIN=$(curl -s -XPOST "$B/comandos/RegistrarElementoPatrimonial" -H "$A" -H "$H" \
  -d '{"nombre":"Fintual","tipo":"fondo","categoriaFuncional":"INVERSION","valorInicial":3000000,"moneda":"CLP"}' | py '["id"]')
OBJ=$(curl -s -XPOST "$B/comandos/CrearObjetivoFinanciero" -H "$A" -H "$H" \
  -d '{"nombre":"Pie vivienda","montoObjetivo":10000000}' | py '["id"]')
ASG=$(curl -s -XPOST "$B/comandos/CrearAsignacion" -H "$A" -H "$H" \
  -d "{\"nombre\":\"Casa\",\"objetivoId\":\"$OBJ\"}" | py '["id"]')
curl -s -XPOST "$B/comandos/CrearReserva" -H "$A" -H "$H" \
  -d "{\"asignacionId\":\"$ASG\",\"elementoOrigenId\":\"$FIN\",\"monto\":2000000}" >/dev/null

echo "✓ Datos demo listos — usuario: demo@patrimonia.cl / demo1234"
echo "  Casa Demo · Cuenta Corriente (gasto corregido) · Departamento (95M→110M)"
echo "  · Fintual · objetivo 'Pie vivienda' 20% (reserva 2M)"
