#!/usr/bin/env bash
# ============================================================================
# Siembra un escenario de prueba COMPLETO en la base local (patrimonia).
# ============================================================================
#   - Borra todo y deja un estado conocido y rico (2 usuarios, hogar, deuda con
#     detalle, objetivo compartido, presupuesto por rubro, multimoneda, etc.).
#   - Los tests e2e NO tocan esta base (usan patrimonia_test) — lo que siembres
#     acá se queda hasta el próximo `./scripts/seed.sh` (o borrar el volumen a
#     mano con `docker volume rm patrimonia_pgdata`).
#
# Requiere el backend corriendo:  ./scripts/api.sh
#
# Usuarios que crea (password: demo1234):
#   demo@patrimonia.cl    — Demo (admin del hogar)
#   pareja@patrimonia.cl  — Pareja (miembro, "designada" del objetivo del hogar)
set -euo pipefail

B="${1:-http://localhost:3000}"
H='content-type: application/json'

jget() { python3 -c "import sys,json;print(json.load(sys.stdin)$1)"; }

api() { # api METHOD PATH JSON [TOKEN]
  local method=$1 path=$2 body=$3 tok=${4:-}
  local args=(-s -X "$method" "$B$path" -H "$H")
  [ -n "$tok" ] && args+=(-H "authorization: Bearer $tok")
  [ -n "$body" ] && args+=(-d "$body")
  local resp
  resp=$(curl "${args[@]}")
  if echo "$resp" | grep -q '"statusCode"'; then
    echo "✗ $method $path" >&2
    echo "  body:  $body" >&2
    echo "  resp:  $resp" >&2
    exit 1
  fi
  echo "$resp"
}

login() { api POST /auth/login "{\"email\":\"$1\",\"password\":\"demo1234\"}" | jget '["accessToken"]'; }

if ! curl -sf -m3 "$B/health" >/dev/null; then
  echo "✗ El backend no responde en $B — corre ./scripts/api.sh primero." >&2
  exit 1
fi

# Fechas relativas (GNU date)
HOY=$(date +%F)
HACE_1A=$(date -d '1 year ago' +%F)
HACE_2A=$(date -d '2 years ago' +%F)
EN_10A=$(date -d '+10 years' +%F)
MES_PASADO_05=$(date -d 'last month' +%Y-%m-05)
MES_PASADO_18=$(date -d 'last month' +%Y-%m-18)
INICIO_MES=$(date +%Y-%m-01)

echo "→ Limpiando la base…"
docker exec patrimonia-postgres psql -U patrimonia -d patrimonia -c "
  TRUNCATE auditoria, membresia, invitacion, hogar, usuario,
    elemento_patrimonial, elemento_propietario, elemento_visibilidad, elemento_comparticion,
    evento_financiero, impacto_patrimonial, valorizacion, ajuste_patrimonial,
    objetivo_financiero, objetivo_designado, asignacion, reserva,
    presupuesto, presupuesto_linea, presupuesto_linea_ahorro,
    movimiento_programado, notificacion, idempotencia, tipo_cambio,
    categoria_movimiento, tipo_elemento, etiqueta, evento_etiqueta,
    agrupacion_elemento, agrupacion_miembro, plantilla_movimiento, dispositivo_push
  RESTART IDENTITY CASCADE" >/dev/null

# ── Usuarios ────────────────────────────────────────────────────────────────
echo "→ Usuarios…"
api POST /comandos/RegistrarUsuario '{"email":"demo@patrimonia.cl","nombre":"Demo","password":"demo1234"}' >/dev/null
api POST /comandos/RegistrarUsuario '{"email":"pareja@patrimonia.cl","nombre":"Pareja","password":"demo1234"}' >/dev/null
DT=$(login demo@patrimonia.cl)
PT=$(login pareja@patrimonia.cl)
PID=$(api GET /usuarios/me '' "$PT" | jget '["id"]')

# ── Hogar ───────────────────────────────────────────────────────────────────
echo "→ Hogar 'Casa Riquelme'…"
HID=$(api POST /comandos/CrearHogar '{"nombre":"Casa Riquelme","monedaConsolidacion":"CLP"}' "$DT" | jget '["id"]')
INV=$(api POST /comandos/InvitarMiembro "{\"hogarId\":\"$HID\",\"emailInvitado\":\"pareja@patrimonia.cl\"}" "$DT" | jget '["id"]')
api POST /comandos/AceptarInvitacion "{\"invitacionId\":\"$INV\"}" "$PT" >/dev/null

# ── Configuración del hogar ─────────────────────────────────────────────────
echo "→ Categorías y tipos…"
CATS=$(api GET "/hogares/$HID/categorias-movimiento" '' "$DT")
CID_SERV=$(echo "$CATS" | python3 -c "import sys,json;print(next(c['id'] for c in json.load(sys.stdin) if c['nombre']=='Servicios'))")
CID_MERC=$(echo "$CATS" | python3 -c "import sys,json;print(next(c['id'] for c in json.load(sys.stdin) if c['nombre']=='Mercado'))")
CID_SUEL=$(echo "$CATS" | python3 -c "import sys,json;print(next(c['id'] for c in json.load(sys.stdin) if c['nombre']=='Sueldo'))")
CID_INT=$(api POST /comandos/CrearCategoriaMovimiento "{\"hogarId\":\"$HID\",\"nombre\":\"Internet y TV\",\"tipoAplicable\":\"GASTO\",\"categoriaPadreId\":\"$CID_SERV\"}" "$DT" | jget '["id"]')
api POST /comandos/CrearCategoriaMovimiento "{\"hogarId\":\"$HID\",\"nombre\":\"Mascotas\",\"tipoAplicable\":\"GASTO\"}" "$DT" >/dev/null
api POST /comandos/CrearTipoElemento "{\"hogarId\":\"$HID\",\"nombre\":\"Billetera digital\",\"categoriaSugerida\":\"LIQUIDEZ\"}" "$DT" >/dev/null

# ── Elementos ───────────────────────────────────────────────────────────────
echo "→ Elementos patrimoniales…"
el() { # el TOKEN JSON  → id
  api POST /comandos/RegistrarElementoPatrimonial "$2" "$1" | jget '["id"]'
}
CC=$(el "$DT" "{\"nombre\":\"Cuenta corriente\",\"tipo\":\"Cuenta corriente\",\"categoriaFuncional\":\"LIQUIDEZ\",\"valorInicial\":1200000,\"moneda\":\"CLP\",\"participaValorLiquido\":true,\"fechaAlta\":\"$HACE_2A\"}")
AHORRO=$(el "$DT" "{\"nombre\":\"Cuenta de ahorro\",\"tipo\":\"Cuenta de ahorro\",\"categoriaFuncional\":\"RESERVA\",\"valorInicial\":4000000,\"moneda\":\"CLP\",\"fechaAlta\":\"$HACE_2A\"}")
FM=$(el "$DT" "{\"nombre\":\"Fondo mutuo Fintual\",\"tipo\":\"Fondo mutuo\",\"categoriaFuncional\":\"INVERSION\",\"valorInicial\":6500000,\"moneda\":\"CLP\",\"admiteValorizacion\":true,\"fechaAlta\":\"$HACE_1A\"}")
USD=$(el "$DT" "{\"nombre\":\"Cuenta en dólares\",\"tipo\":\"Billetera digital\",\"categoriaFuncional\":\"LIQUIDEZ\",\"valorInicial\":2500,\"moneda\":\"USD\"}")
TC=$(el "$DT" "{\"nombre\":\"Tarjeta de crédito\",\"tipo\":\"Tarjeta de crédito\",\"categoriaFuncional\":\"DEUDA\",\"valorPendiente\":380000,\"moneda\":\"CLP\"}")
HIP=$(el "$DT" "{\"nombre\":\"Crédito hipotecario\",\"tipo\":\"Crédito hipotecario\",\"categoriaFuncional\":\"DEUDA\",\"valorPendiente\":48000000,\"moneda\":\"CLP\",\"contraparte\":\"Banco Estado\",\"tasaInteres\":4.2,\"fechaInicio\":\"$HACE_2A\",\"fechaTermino\":\"$EN_10A\",\"cuotaMonto\":420000}")
# Departamento en co-propiedad 60/40 (Demo y Pareja comparten hogar → P12 OK)
DEP=$(el "$DT" "{\"nombre\":\"Departamento\",\"tipo\":\"Propiedad\",\"categoriaFuncional\":\"ACTIVO\",\"valorInicial\":95000000,\"moneda\":\"CLP\",\"admiteValorizacion\":true,\"participaConsolidacion\":true,\"fechaAlta\":\"$HACE_2A\",\"propietarios\":[{\"usuarioId\":\"$(api GET /usuarios/me '' "$DT" | jget '["id"]')\",\"porcentaje\":60},{\"usuarioId\":\"$PID\",\"porcentaje\":40}]}")
SUELDO_P=$(el "$PT" "{\"nombre\":\"Cuenta sueldo\",\"tipo\":\"Cuenta corriente\",\"categoriaFuncional\":\"LIQUIDEZ\",\"valorInicial\":900000,\"moneda\":\"CLP\"}")

# ── Movimientos ─────────────────────────────────────────────────────────────
echo "→ Movimientos…"
api POST /comandos/RegistrarEventoFinanciero "{\"tipo\":\"INGRESO\",\"monto\":1850000,\"moneda\":\"CLP\",\"elementoDestinoId\":\"$CC\",\"categoriaId\":\"$CID_SUEL\",\"glosa\":\"Sueldo\",\"fecha\":\"$MES_PASADO_05\"}" "$DT" >/dev/null
api POST /comandos/RegistrarEventoFinanciero "{\"tipo\":\"GASTO\",\"monto\":245000,\"moneda\":\"CLP\",\"elementoOrigenId\":\"$CC\",\"categoriaId\":\"$CID_MERC\",\"glosa\":\"Supermercado quincena\",\"fecha\":\"$MES_PASADO_18\"}" "$DT" >/dev/null
api POST /comandos/RegistrarEventoFinanciero "{\"tipo\":\"GASTO\",\"monto\":54990,\"moneda\":\"CLP\",\"elementoOrigenId\":\"$CC\",\"categoriaId\":\"$CID_INT\",\"glosa\":\"Plan fibra + streaming\",\"fecha\":\"$MES_PASADO_18\"}" "$DT" >/dev/null
G=$(api POST /comandos/RegistrarEventoFinanciero "{\"tipo\":\"GASTO\",\"monto\":30000,\"moneda\":\"CLP\",\"elementoOrigenId\":\"$CC\",\"glosa\":\"Farmacia\",\"fecha\":\"$MES_PASADO_18\"}" "$DT" | jget '["id"]')
api POST /comandos/CorregirEventoFinanciero "{\"eventoId\":\"$G\",\"nuevoMonto\":24500,\"motivo\":\"el monto real era 24.500\"}" "$DT" >/dev/null
# Abono al hipotecario (transferencia cuenta → deuda)
api POST /comandos/RegistrarEventoFinanciero "{\"tipo\":\"TRANSFERENCIA\",\"monto\":420000,\"moneda\":\"CLP\",\"elementoOrigenId\":\"$CC\",\"elementoDestinoId\":\"$HIP\",\"glosa\":\"Cuota del mes\",\"fecha\":\"$MES_PASADO_05\"}" "$DT" >/dev/null
# Interés del período sobre el hipotecario (Ajuste — DEUDA crece → monto negativo)
api POST /comandos/RegistrarAjustePatrimonial "{\"elementoId\":\"$HIP\",\"monto\":-168000,\"motivo\":\"Interés del período\",\"fecha\":\"$MES_PASADO_05\"}" "$DT" >/dev/null

# ── Valorizaciones ──────────────────────────────────────────────────────────
echo "→ Valorizaciones…"
api POST /comandos/RegistrarValorizacion "{\"elementoId\":\"$DEP\",\"valorNuevo\":112000000,\"fecha\":\"$HACE_1A\"}" "$DT" >/dev/null
api POST /comandos/RegistrarValorizacion "{\"elementoId\":\"$FM\",\"valorNuevo\":6820000,\"fecha\":\"$MES_PASADO_05\"}" "$DT" >/dev/null

# ── Objetivos ───────────────────────────────────────────────────────────────
echo "→ Objetivos y reservas…"
OBJ_H=$(api POST /comandos/CrearObjetivoFinanciero "{\"nombre\":\"Viaje a Japón\",\"montoObjetivo\":8000000,\"fechaObjetivo\":\"$EN_10A\",\"hogarId\":\"$HID\"}" "$DT" | jget '["id"]')
api POST /comandos/DefinirDesignadosObjetivo "{\"objetivoId\":\"$OBJ_H\",\"usuarioIds\":[\"$PID\"]}" "$DT" >/dev/null
ASG_D=$(api POST /comandos/CrearAsignacion "{\"nombre\":\"Aporte Demo\",\"objetivoId\":\"$OBJ_H\"}" "$DT" | jget '["id"]')
api POST /comandos/CrearReserva "{\"asignacionId\":\"$ASG_D\",\"elementoOrigenId\":\"$AHORRO\",\"monto\":1500000}" "$DT" >/dev/null
ASG_P=$(api POST /comandos/CrearAsignacion "{\"nombre\":\"Aporte Pareja\",\"objetivoId\":\"$OBJ_H\"}" "$PT" | jget '["id"]')
api POST /comandos/CrearReserva "{\"asignacionId\":\"$ASG_P\",\"elementoOrigenId\":\"$SUELDO_P\",\"monto\":300000}" "$PT" >/dev/null

OBJ_E=$(api POST /comandos/CrearObjetivoFinanciero '{"nombre":"Fondo de emergencia","montoObjetivo":3000000}' "$DT" | jget '["id"]')
ASG_E=$(api POST /comandos/CrearAsignacion "{\"nombre\":\"Colchón\",\"objetivoId\":\"$OBJ_E\"}" "$DT" | jget '["id"]')
api POST /comandos/CrearReserva "{\"asignacionId\":\"$ASG_E\",\"elementoOrigenId\":\"$AHORRO\",\"monto\":1200000}" "$DT" >/dev/null

api POST /comandos/CrearObjetivoFinanciero '{"nombre":"Notebook nuevo","montoObjetivo":1500,"moneda":"USD"}' "$DT" >/dev/null

# ── Presupuesto ─────────────────────────────────────────────────────────────
echo "→ Presupuesto mensual…"
PRE=$(api POST /comandos/CrearPresupuesto "{\"tipo\":\"INDIVIDUAL\",\"periodicidad\":\"PERIODICO\",\"intervalo\":\"MENSUAL\",\"fechaInicio\":\"$INICIO_MES\",\"ingresosEsperados\":1850000,\"gastosEsperados\":1400000,\"ahorroEsperado\":400000}" "$DT" | jget '["id"]')
api POST /comandos/DefinirLineasPresupuesto "{\"presupuestoId\":\"$PRE\",\"lineas\":[{\"categoriaId\":\"$CID_MERC\",\"montoEsperado\":320000},{\"categoriaId\":\"$CID_SERV\",\"montoEsperado\":140000}]}" "$DT" >/dev/null
api POST /comandos/DefinirLineasAhorroPresupuesto "{\"presupuestoId\":\"$PRE\",\"lineas\":[{\"objetivoId\":\"$OBJ_E\",\"montoEsperado\":200000}]}" "$DT" >/dev/null

# ── Movimiento programado + tipo de cambio + preferencias ───────────────────
echo "→ Movimiento programado, tipo de cambio, preferencias…"
api POST /comandos/CrearMovimientoProgramado "{\"tipo\":\"INGRESO\",\"montoPlanificado\":1850000,\"moneda\":\"CLP\",\"fechaProgramada\":\"$HOY\",\"elementoDestinoId\":\"$CC\",\"observaciones\":\"Sueldo mensual\"}" "$DT" >/dev/null
api POST /comandos/RegistrarTipoCambio '{"monedaOrigen":"USD","monedaDestino":"CLP","tasa":960}' "$DT" >/dev/null
api POST /comandos/ActualizarDatosUsuario '{"preferencias":{"notificaciones":{"RESERVA_CONSUMIDA":false}}}' "$DT" >/dev/null

echo
echo "✓ Escenario listo. Entra con  demo@patrimonia.cl / demo1234  (o pareja@patrimonia.cl)"
echo "  Casa Riquelme · 8 elementos (depto en co-propiedad 60/40, hipotecario con"
echo "  detalle + interés, cuenta USD) · movimientos con categorías/subcategoría y"
echo "  una corrección · 2 valorizaciones · objetivo 'Viaje a Japón' compartido con"
echo "  Pareja designada · 'Fondo de emergencia' personal · objetivo en USD ·"
echo "  presupuesto mensual con líneas por rubro y de ahorro · sueldo programado."
