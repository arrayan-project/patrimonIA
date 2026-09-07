# PatrimonIA

Gestión de patrimonio familiar. Backend NestJS + PostgreSQL, cliente React Native (Expo).

Documentos de diseño (fuente de verdad): `Docs/` — leer en el orden de
`Docs/BUILD_INSTRUCTIONS.md`.

## Estructura

Monorepo con dos paquetes independientes:

- `api/` — backend NestJS + PostgreSQL.
- `api/db/` — infraestructura de base de datos (Docker + esquema).
- `app/` — cliente Expo.

Se elige monorepo (y no dos repos) porque el contrato TypeScript se comparte
end-to-end (nombres de comando, tipos de payload) y la trazabilidad
DDD → Application Services → API → código es más fácil de mantener en un solo
árbol. Los paquetes se despliegan por separado.

## Estado de construcción

Se construye vertical (un flujo completo end-to-end a la vez), no horizontal.

- [x] **Fase 0 — DB**: esquema PostgreSQL ejecutado y verificado en Docker
  (`postgres:16`). Ver `api/db/README.md`.
- [x] **Fase 0 — backend**: NestJS 12 + Prisma 7 sobre PostgreSQL. `GET /health`
  responde 200 con ping real a la DB. Ver `api/README.md`.
- [x] **Fase 0 — app**: Expo SDK 57 + TypeScript, pantalla en blanco. Ver `app/README.md`.
- [x] **Fase 1 — esqueleto vertical Flujo 2 (Alta de hogar)**:
  - [x] Backend: AS #43 RegistrarUsuario, #34 CrearHogar, #37 InvitarMiembro,
    #38 AceptarInvitacion, #39 RechazarInvitacion. Auditoría en la misma
    transacción desde el primer comando. Auth JWT. e2e en verde.
  - [x] Móvil: pantallas Registro / Bienvenida / Crear Hogar / Invitaciones /
    Dashboard. `tsc` + `expo export` limpios; render confirmado en web.
- [x] **Fase 2 — Flujo 1 (día a día financiero)**:
  - [x] Backend: AS #1 RegistrarElementoPatrimonial, #10 RegistrarEventoFinanciero
    (INGRESO/GASTO/TRANSFERENCIA) + impacto_patrimonial + valor_vigente +
    proyección patrimonio_individual. e2e en verde.
  - [x] Móvil: Dashboard con patrimonio + elementos, Agregar elemento, Registrar
    movimiento, Detalle de elemento.
- [x] **Fase 3 — Flujo 6 (corregir / anular un movimiento)**:
  - [x] Backend: AS #11 AnularEventoFinanciero, #12 CorregirEventoFinanciero
    (patrón de corrección). e2e en verde.
  - [x] Móvil: detalle de movimiento con acciones Corregir / Anular; en el
    detalle de elemento los anulados van tachados y las correcciones etiquetadas.
- [x] **Fase 4 — Flujo 3 (activo no líquido + valorización)**:
  - [x] Backend: AS #17 RegistrarValorizacion, #18 AnularValorizacion,
    #19 CorregirValorizacion. e2e en verde.
  - [x] Móvil: toggle "se valoriza" al crear el elemento; sección Valorizaciones
    en el detalle con Registrar / Corregir / Anular.
- [x] **Fase 5** (backend + app, e2e en verde):
  - [x] **5a** — Ajuste Patrimonial (AS #20/#21/#22). Cierra el trío del patrón
    de corrección (Evento, Valorización, Ajuste).
  - [x] **5b** — comandos de ciclo de vida: Elemento (#2-#9), Hogar
    (#35/#36/#40/#41/#42/#45), Usuario (#44/#46).
  - [x] **5c** — Flujo 5: Objetivo (#30-#33) + Asignación (#23-#26) + Reserva
    (#27-#29) + proyección progreso + políticas "Completar objetivo" /
    "Consumir reserva". Migración 001 (columna `usuario_id`).
- [x] **Fase 6 — Presupuesto (Agregado K, AS #49–#52)**:
  - [x] Backend: CrearPresupuesto, ActualizarDatosPresupuesto, CerrarPresupuesto
    (solo específicos), EliminarPresupuesto + proyección `desviacion_presupuestaria`
    (presupuestado vs. real, en vivo). Migración 002 (`usuario_id` / `hogar_id`).
    e2e en verde.
  - [x] Móvil: pantalla Presupuestos (lista + alta) y detalle con la
    comparación presupuestado-vs-real y acciones Editar / Cerrar / Eliminar.
- [x] **Fase 7 — Movimiento Programado (agregado propio, AS #13–#16)**:
  - [x] Backend: CrearMovimientoProgramado, ActualizarMovimientoProgramado
    (solo PENDIENTE), MaterializarMovimientoProgramado (dispara un Evento
    INGRESO hacia el destino, con una sola entrada de auditoría),
    CancelarMovimientoProgramado. Autorización heredada del elemento destino
    (GAPS.md G2). e2e en verde.
  - [x] Móvil: pantalla Movimientos programados (lista + alta) y detalle con
    Materializar / Editar / Cancelar.
- [x] **Fase 8 — Deuda / Crédito (especialización de Elemento, Flujo 4, AS #47/#48)**:
  - [x] Backend: `RegistrarElementoPatrimonial` acepta categoría DEUDA/CREDITO
    con `valorPendiente` (deriva `valor_vigente` con signo). CondonarDeuda,
    DeclararIncobrable. Política "Derivar estado operativo" = invariante
    `valor_pendiente == |valor_vigente|` tras cada impacto (evento y ajuste).
    Migración 003 (orígenes de impacto). `?categoria=DEUDA|CREDITO`. e2e en verde.
  - [x] Móvil: alta de deuda/crédito; en el detalle, saldo pendiente + acción
    Condonar / Declarar incobrable.

- [x] **Fase 9 — Reconstrucción histórica (DDD Sección V)**:
  - [x] Backend: `impacto_patrimonial.fecha` (migración 004). Valor de un elemento
    a una fecha (`GET /elementos-patrimoniales/:id/valor-historico?fecha=`),
    patrimonio individual a una fecha, y variación patrimonial entre dos fechas.
    e2e en verde.
  - [x] Móvil: pantalla "Evolución de mi patrimonio" (variación entre dos fechas).
- [x] **Fase 10 — Consolidación y métricas del hogar (DDD Secciones Q / N)**:
  - [x] Backend: `GET /hogares/:id/patrimonio-consolidado` (neto/activos/pasivos/
    líquido por moneda), `GET /hogares/:id/metricas` (distribución por categoría,
    liquidez, avance de objetivos), `GET /hogares/:id/eventos-financieros` (vista
    colapsada). e2e en verde.
  - [x] Móvil: pantalla "Patrimonio del hogar".
- [x] **Fase 11 — Notificaciones (Principio 4)**:
  - [x] Backend: tabla `notificacion` (migración 005), emitidas desde las
    políticas "Completar objetivo" / "Consumir reserva" y desde InvitarMiembro.
    `GET /usuarios/me/notificaciones(/no-leidas)`, `POST .../:id/leer`,
    `POST .../leer-todas`. e2e en verde.
  - [x] Móvil: bandeja de notificaciones con contador en el Dashboard.
- [x] **Fase 12 — Infraestructura de API**:
  - [x] `Idempotency-Key` en `POST /comandos/*` (interceptor global, tabla
    `idempotencia`, migración 006): un reintento con la misma clave devuelve la
    respuesta guardada sin re-ejecutar.
  - [x] Token de pre-registro: `POST /auth/registro-token` + `RegistroTokenGuard`
    (activo solo con `AUTH_REGISTRO_TOKEN_REQUERIDO=true`). Falta el gate previo
    (captcha/email) — GAPS.md G4.
  - e2e en verde. Sin cambios en la app.
- [x] **Fase 13 — Multimoneda (REQUISITES §514–532)**:
  - [x] Backend: tabla `tipo_cambio` (migración 007) + comando nº 53
    `RegistrarTipoCambio` + `ConversionService` (tasa vigente a la fecha, inverso
    si no hay par directo). Evento **CONVERSION** (cambio de moneda entre dos
    elementos). Total consolidado del hogar en su moneda (`total` /
    `conversionesFaltantes`). e2e en verde.
  - [x] Móvil: pantalla "Tipos de cambio", opción CONVERSION en registrar
    movimiento, total en "Patrimonio del hogar".

- [x] **Fase 14 — Deuda técnica**:
  - [x] **14a** App: `@react-navigation` (fachada `useNav()` intacta), sesión
    persistida (`expo-secure-store` / `localStorage`), selector multi-hogar.
  - [x] **14b** — tests unitarios (`api/src/**/*.spec.ts`, sin DB) + CI
    (`.github/workflows/ci.yml`: Postgres de servicio, lint/build/unit/e2e + app).
  - [x] **14c** — triangulación de divisas por pivote (G21); pre-registro con
    rate-limit por IP + token ligado y enviado por email (`EmailSender`
    intercambiable, G4); push notifications (`dispositivo_push` migr. 008 +
    `ExpoPushSender`, G20). Falta solo el captcha y un development build para el
    push real.

- [ ] **Fase 15 — UI / UX** (backlog en `Docs/UI_UX_BACKLOG.md`):
  - [x] **15a** — auto-refresh al enfocar (`useCargaAlEnfocar`), pull-to-refresh
    (`Screen onRefresh=`), `Idempotency-Key` en las altas (`api.comando`),
    401 → logout automático.
  - [x] **15b** — `DateField` (calendario nativo), `MoneyField` (formato de
    miles), campo fecha en Registrar movimiento/ajuste/Valorizar, `ToastProvider`,
    `confirmar()` + botón `danger` en acciones destructivas, `fechaLegible()`.
  - [x] **15c** — glosa en `evento_financiero`, `categoria_movimiento` del hogar
    (migración 009; comandos Crear/Actualizar/Archivar/Reordenar; seed al crear
    hogar), selector de categoría + detalle al registrar movimiento, pantalla
    Ajustes → Categorías, `GET /usuarios/me` con `preferencias`.
  - [x] **15d** — presupuesto por rubro: `presupuesto_linea` (migración 010,
    `GAPS.md` G26), comando `DefinirLineasPresupuesto`, `desviacion` con desglose
    `porRubro` + `sinClasificar`, pantalla editor de rubros + barra de
    distribución apilada en el detalle del presupuesto.
  - [x] **15e** — navegación: barra de tabs inferior (Inicio · Movimientos ·
    Objetivos · Hogar · Ajustes), header nativo con botón atrás en las pantallas
    apiladas (se quitaron los enlaces "Volver"), Dashboard jerarquizado con hubs
    `Movimientos` / `Hogar`. `@react-navigation/bottom-tabs`.
  - [x] **15f** — textos: `src/labels.ts` (`etiqueta()` + `humanizar()`)
    traduce los enums del dominio (`LIQUIDEZ` → "Liquidez", `EN_PROGRESO` →
    "En progreso", `cuenta_corriente` → "Cuenta corriente"…); `Segmented`
    formatea sus opciones; `fechaRelativa()` en notificaciones.
  - [x] **15g** — gráficos: `react-native-svg` + `src/ui/charts.tsx` (`Dona`,
    `GraficoLinea`) en presupuesto por rubro, "Patrimonio del hogar" y
    "Evolución de mi patrimonio" (`GET /usuarios/me/serie-patrimonial`);
    tarjeta de resumen del Dashboard (neto · líquido · variación 30 días);
    iconos de tabs con `@expo/vector-icons`.
  - [x] **15h** — plantillas de movimiento: `plantilla_movimiento`
    (migración 011, `GAPS.md` G24), comandos Crear/Actualizar/Eliminar,
    `GET /usuarios/me/plantillas-movimiento`; app: pantalla Plantillas,
    "Desde una plantilla" al registrar un movimiento y "Guardar como
    plantilla" en el detalle.
  - [x] **15i** — etiquetas de movimiento: `etiqueta` + `evento_etiqueta`
    (migración 012, `GAPS.md` G23), comandos Crear/Actualizar/Eliminar/
    EtiquetarEvento, `RegistrarEventoFinanciero.etiquetaIds`; app: pantalla
    Etiquetas, chips al registrar y en el detalle del movimiento.
  - [x] **15j** — agrupaciones de elementos: `agrupacion_elemento` +
    `agrupacion_miembro` (migración 013, `GAPS.md` G23), comandos Crear/
    Actualizar/Eliminar/DefinirElementosAgrupacion; app: pantalla Agrupaciones
    y la lista de "Elementos" del Inicio agrupada por carpeta. Bloque C del
    backlog cerrado (glosa, categorías, presupuesto por rubro, plantillas,
    etiquetas, agrupaciones).
  - [x] **15k** — controles de entrada: componente `Select` (hoja modal +
    "Otro…") para categoría funcional, tipo de elemento (con presets) y moneda
    (ISO 4217); `KeyboardAvoidingView` en `Screen`; `MoneyText` (rojo/contable
    para negativos) en el detalle de elemento.
  - [x] **15l** — pulido: iconos en los menús (hubs), `EmptyState` en las
    listas principales, deep-link al tocar una notificación, card "Primeros
    pasos" en el Dashboard.
  - [ ] 15m+ — design tokens completos, buscadores en pickers, co-propietarios
    con %, F3 en más pantallas, FAB.

- [x] **Fase 16 — Reportes financieros + reorganización de navegación**:
  - [x] Backend: `GET /usuarios/me/resumen-financiero?desde=&hasta=&alcance=` y
    `GET /usuarios/me/resumen-anual?anio=&alcance=` — proyección de lectura que
    agrega los `evento_financiero` existentes (totales por moneda, desglose por
    rubro, lista de movimientos); alcance `mios` / `hogar`. `GAPS.md` G27.
  - [x] App: la tab **Movimientos** pasa a ser la vista mensual/anual (selector
    ‹ mes/año ›, toggle Míos/Hogar, dona de gastos por rubro, lista, barras
    anuales). Nueva tab **Planificar** (objetivos + presupuestos + programados +
    plantillas + evolución). El Dashboard suelta el bloque de miembros/invitar
    (→ Gestionar hogar); las categorías del hogar pasan de Ajustes a la tab Hogar.

- [x] **Fase 17 — Sistema visual + ayuda contextual** (solo app):
  - [x] Página sobre gris suave (`colors.fondo`) con tarjetas blancas que
    resaltan; componente `Card` (con chevron "ver más" y franja de color) y
    `Ayuda` (caja de explicación breve). Chevron en las filas tocables, puntos
    de color por agrupación en el Inicio, cajas de ayuda en 8 pantallas
    (objetivos, asignaciones, presupuestos, etiquetas…).

- [x] **Fase 18 — Acciones y explicaciones** (solo app):
  - [x] `FAB` "+" para "Registrar movimiento" en Inicio y Movimientos.
  - [x] Editar elemento: toggle "¿Cuenta en el patrimonio del hogar?"
    (`CambiarParticipacionEnConsolidacion`), visibilidad con ayuda.
  - [x] "Agregar elemento": explicación de la categoría funcional según la
    opción elegida. Patrimonio neto en rojo si es negativo.

- [x] **Fase 19 — Carga y pickers** (solo app):
  - [x] Componente `Skeleton` en las pantallas de lista (en vez del spinner);
    "Buscar elemento" en los pickers de Registrar movimiento (> 6 elementos);
    barra de avance total en la lista de Objetivos.
  - [x] Fix: en iPhone el título quedaba bajo el notch en las pantallas de tab.

**Cobertura**: los 52 Application Services de Fase 0 + 26 comandos añadidos en
Fases 13–52 (categorías, etiquetas, agrupaciones, tipos de elemento, plantillas,
presupuesto por rubro, visibilidad granular, objetivos del hogar, tipo de
cambio). Ver `Docs/APPLICATION_SERVICES.md` §"Casos de uso añadidos".

Fases posteriores a la 19 (rediseño monocromático, reorganización de IA, y el
cierre de los hallazgos del análisis de dominio) están en `GAPS.md` (G27–G30) y
`Docs/UX_FLOWS.md` Parte 3. Los `.docx` de diseño se migraron a Markdown el
2026-09-06 (originales en `Docs/_baseline/`).

## Tests

```bash
cd api && npm run test:all   # 20 unitarios + 157 e2e
cd app && npx tsc --noEmit && npx expo export --platform web
```

Vacíos y decisiones pendientes: ver `GAPS.md`. Solo quedan 3 integraciones
externas (captcha, push real, import de tipos de cambio).

## Requisitos de entorno

- **Node 22.12+** — el toolchain (NestJS 12, Prisma 7, Expo 57) lo exige. Con
  Node 20 el backend arranca y muere sin escuchar nada. En cada carpeta
  (`api/`, `app/`) corre `nvm use` antes de `npm ...`; los scripts `start`
  abortan con un mensaje si detectan una versión vieja. Verifica con `node -v`.
- Docker (para PostgreSQL local, no requiere Postgres instalado).

## Probar en el teléfono

**Guía completa (arrancar desde cero, tras reiniciar el laptop):
[`Docs/CORRER_EN_LOCAL.md`](Docs/CORRER_EN_LOCAL.md)**

Resumen — dos terminales:
```bash
./scripts/db.sh && ./scripts/api.sh   # terminal 1: base de datos + backend
./scripts/app.sh                      # terminal 2: Expo (muestra el QR)
./scripts/estado.sh                   # diagnóstico: ¿qué está andando?
./scripts/parar.sh                    # cierra backend + Expo si se colgaron
```
Los scripts eligen Node 22 solos. Firewall (una vez): `sudo ufw allow 3000/tcp`
y `sudo ufw allow 8081/tcp`. No hay usuario de prueba: se crea en "Crear cuenta".
