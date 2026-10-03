# Vacíos y decisiones pendientes

**Objetivo:** el ledger vivo de decisiones de dominio de todo el proyecto —
cada vacío que apareció construyendo, por qué no estaba resuelto de antemano,
qué opciones se evaluaron y cuál se eligió. Es el único lugar donde se
registra el *porqué*; los documentos de `Docs/diseño/` reflejan el *qué*
ya resuelto. (Nota: los documentos que este archivo referencia como
`DDD.md`, `DATABASE_DESIGN.md`, etc. viven en `Docs/diseño/`.)

Formato tomado de `Docs/diseño/UX_FLOWS.md` § "Resumen y vacíos detectados": qué se
necesita, por qué no está resuelto, qué opciones existen. Nada de esto se
resuelve inventando una regla de negocio (BUILD_INSTRUCTIONS §4).

> **Este archivo es el _ledger_ de decisiones**: registra el porqué de cada
> vacío y la alternativa que se descartó. Las decisiones ya `✅ RESUELTO` están
> **integradas en los canónicos** — `DDD.md` §X, `DATABASE_DESIGN.md` §13,
> `APPLICATION_SERVICES.md` (#53+), `API_DESIGN.md`, `UX_FLOWS.md` Parte 3.
> Lo **abierto** está todo en la Parte 1 (Pendiente), con un resumen priorizado
> al inicio.

**Estado de cada gap:** `✅ RESUELTO` · `✅ DECISIÓN CERRADA` (se decidió no
cambiar nada o dejarlo como está) · `🟡 PARCIAL` (núcleo hecho, quedan
sub-ítems) · `⬜ PENDIENTE` (accionable ya, sin decisión) · `📋 DECISIÓN`
(necesita definición del usuario) · `🔒 EXTERNO` (bloqueado por proveedor externo).

**Cómo está ordenado este archivo**: primero lo **pendiente** (Parte 1), después
lo **implementado o cerrado como decisión** (Parte 2). Dentro de cada parte, los
gaps van agrupados por **tema** (A–I) y, dentro de cada tema, en orden de número.
Los números G no se renumeran: son identificadores fijos que se citan en el
código, las migraciones, los tests y los commits (G-J va junto a G1, ambos de
Deuda/Crédito). Los códigos P/U son los ítems del plan de trabajo.

## Índice por tema

| Tema | Pendiente | Implementado / decisión cerrada |
|---|---|---|
| **A** · Cuenta y autenticación | G4 (captcha), G34 | G31 |
| **B** · Hogar, membresías y consolidación | — | G3, G5, G12, G19, G30 |
| **C** · Elementos patrimoniales y visibilidad | — | G6, G11, G18, G29 |
| **D** · Deuda / Crédito | — | G1, G-J, G17, G28 |
| **E** · Movimientos financieros | — | G8, G9, G10, G22, G23, G24 |
| **F** · Planificación: objetivos, reservas, presupuestos y programados | — | G2, G13, G14, G15, G16, G26 |
| **G** · Monedas, proyecciones y reportes | — | G7, G21, G27 |
| **H** · Notificaciones | G20 | — |
| **I** · App: preferencias y usabilidad | G25 (densidad), G32, G33 | — |

---

# Parte 1 · Pendiente

## 1.1 Resumen priorizado

Todo lo que sigue abierto, de lo más accionable a lo más bloqueado.

| # | Gap | Qué falta | Tipo |
|---|-----|-----------|------|
| U5 | **G33** | Rediseño de usabilidad tras la prueba con usuaria real (`Docs/usabilidad/USABILIDAD_REAL_S01.md`). Fases A, B y C ✅ + BUG-HOG ✅. Fase D ✅ (decisiones D-1 a D-8, prototipo validado 6 de 6, HZ-18 a HZ-23). Fase E: bloque 1 (D-4, HZ-19, HZ-22) ✅; bloque 2 (HZ-3 + HZ-17) ✅; bloque 3 (HZ-24) ✅; bloque 4 (rediseño visual) ✅; siguiente: bloque 5 (HZ-13). | ⬜ |
| — | **G34** | El login distingue mayúsculas en el email. Resuelto: el login pasa el email a minúsculas, como el registro (2026-10-03). | ✅ |
| U4 | **G32** | Evaluación heurística ✅, 7 ajustes ✅, validación con persona nueva ✅ con **resultado negativo** → se continúa en G33. | 🟡 (sigue en G33) |
| — | **G25** | v1 hecha (formato de fecha, moneda principal, secciones del Inicio). Queda: densidad. | 🟡 parcial |
| U3 | **G1** (UI) | `ListItem` en las listas restantes (rows con edición inline + reordenar, no calzan). | 📋 diferido |
| P14 | **G4** | Captcha / anti-bot antes de emitir el token de registro — hay que elegir proveedor. El rate-limit en memoria necesitaría un store compartido para varias instancias. | 🔒 externo |
| P15 | **G20** | Push remoto real: development build + `projectId` de EAS (Expo Go SDK 53+ lo limita). | 🔒 externo |

> U3 se refiere al hallazgo G1 del backlog de UI (`Docs/retirado/UI_UX_BACKLOG.md`),
> no al gap G1 de Deuda/Crédito.

## 1.2 Detalle por tema

### Tema A · Cuenta y autenticación

#### G4 — "Token de sesión temporal de registro" para RegistrarUsuario  🔒 EXTERNO (token + email ✅; falta el captcha)
- **Qué falta**: API_DESIGN dice que `POST /comandos/RegistrarUsuario` va con un
  "token de sesión temporal de registro, no de usuario ya autenticado".
- **Estado (Fase 12 + 14c)**: **resuelto salvo el captcha**.
  - `POST /auth/registro-token` (anónimo, **rate-limit 10/hora por IP** —
    `RateLimiter` en memoria) emite un JWT `{ purpose: 'registro' }` de 15 min.
    Si se le pasa `email`, se le **envía por correo un código de 6 dígitos**
    (`EmailSender`: `BrevoEmailSender` si hay `BREVO_API_KEY`, si no
    `ConsoleEmailSender` — ver G31) que se canjea en
    `POST /auth/verificar-codigo-registro { email, codigo }` por el token,
    **ligado a ese email**. Mismo mecanismo que el reset (tabla
    `codigo_verificacion`, 15 min, 5 intentos — ver G31, migración 026).
  - En modo requerido (`AUTH_REGISTRO_TOKEN_REQUERIDO=true`) el token **no** se
    devuelve en la respuesta (`{ enviado: true }`), solo se obtiene con el código;
    y `RegistroTokenGuard` exige que el `email` del token coincida con el del alta.
  - En dev/test el endpoint devuelve el token directo y el guard no bloquea.
- **Pendiente**: el captcha / verificación anti-bot antes de emitir el token
  (rate-limit + email ya reducen el abuso; el captcha necesita elegir proveedor).
  Rate-limit en memoria → para varias instancias haría falta un store compartido.

#### G34 — El login distingue mayúsculas en el email  ✅ RESUELTO (2026-10-03)
- **Qué pasa**: `POST /auth/login` busca el email tal cual llega
  (`auth.service.ts`, `login`), pero el registro y la recuperación de contraseña
  lo pasan a minúsculas. Quien se registró como `juan@…` y entra escribiendo
  `Juan@…` recibe "Credenciales inválidas". Verificado contra el backend local.
- **Arreglo**: el login pasa el email a minúsculas en `auth.controller.ts`,
  como el registro y el reset. Test e2e en
  `api/test/reset-password.e2e-spec.ts` ("G34: …").

### Tema H · Notificaciones

#### G20 — Notificaciones (Fase 11 + 14c)  🟡 PARCIAL (in-app + preferencias ✅; push remoto 🔒; reintentos ✅)
- In-app: ✅. **Preferencias por tipo: ✅ (Fase 36, P4)** —
  `usuario.preferencias.notificaciones[<tipo>] === false` silencia el aviso
  (in-app + push); `NotificacionService.emitir` lo consulta; toggles en "Mi
  perfil". Push remoto: 🔒 EXTERNO (development build + `projectId` de EAS).
  **Reintentos de envío fallido: ✅** — `ExpoPushSender` reintenta ante error
  de red, 429 o 5xx (2 reintentos, 1 s y 4 s; un 4xx no se reintenta) y
  devuelve los tokens con ticket `DeviceNotRegistered`, que
  `NotificacionService` borra de `dispositivo_push`. Tests:
  `src/notificacion/push-sender.spec.ts` (con `fetch` mockeado — el envío real
  depende del push remoto, P15).
- **In-app (Fase 11)**: tabla `notificacion` (migración 005), registro que NO es
  dominio (sin auditoría, regenerable). Se emite dentro de la transacción del
  comando. Generadores: **OBJETIVO_COMPLETADO**, **RESERVA_CONSUMIDA**,
  **INVITACION_RECIBIDA**. Endpoints `GET /usuarios/me/notificaciones(/no-leidas)`,
  `POST .../:id/leer`, `POST .../leer-todas`.
- **Push (Fase 14c)**: tabla `dispositivo_push` (migración 008) con los Expo push
  tokens del usuario (`POST` / `DELETE /usuarios/me/dispositivos-push`). Al emitir
  una notificación se dispara un push best-effort (fuera de la transacción —
  podría llegar huérfano si el comando revierte) vía `PushSender` →
  `ExpoPushSender` (POST a la Expo Push API, sin credenciales). La app registra
  el token al iniciar sesión (`src/push/registerPush.ts`).
- **Pendiente**: el push remoto necesita un **development build + `projectId` de
  EAS** — en Expo Go SDK 53+ está limitado, y en web/simulador `registerPush`
  devuelve null (no rompe nada).

### Tema I · App: preferencias y usabilidad

#### G25 — Sección de Ajustes / preferencias de visualización  🟡 PARCIAL (tema + hub ✅; preferencias v1 ✅ 2026-09-29; densidad ⬜)
- ✅ (2026-09-29) **Preferencias v1** en `usuario.preferencias.visualizacion`
  (sin migración: el JSONB ya existía y `ActualizarDatosUsuario` lo acepta):
  `formatoFecha` (`legible` "15 mar 2026" | `numerico` "15-03-2026"),
  `monedaPreferida` (qué moneda muestra el Inicio como principal si hay varias —
  **no convierte**) y `dashboard` (mostrar/ocultar Composición, Disponibilidad,
  Flujo del mes, Objetivos, Accesos rápidos). Defaults en el cliente
  (`app/src/preferencias.tsx`, `PreferenciasProvider`); pantalla Ajustes ›
  Apariencia › Visualización. Al guardar se parte del objeto vigente para no
  pisar `notificaciones`. `fechaLegible()` lee la preferencia, así que aplica a
  toda la app.
- **Decisión usuario vs. hogar**: lo personal va en `usuario.preferencias`; lo
  del hogar ya tiene su lugar normalizado (`categoria_movimiento`,
  `tipo_elemento`, `hogar.moneda_consolidacion`), así que **no** se agrega
  `hogar.configuracion JSONB`. El tema sigue siendo del dispositivo.
- ⬜ Densidad (compacta/cómoda): toca los estilos de todos los componentes de
  `ui/`; se deja para cuando se revise el sistema de diseño.
- `GET /usuarios/me` ya devuelve `preferencias`; hay pantalla Ajustes (hub) y
  selector de tema (Fase 28). Falta: darle forma al objeto de preferencias
  (formato de fecha, secciones visibles del dashboard, densidad, moneda de
  despliegue) — cada toggle es chico — y 📋 decidir qué es del usuario y qué del
  hogar (`hogar.configuracion JSONB` vs. tablas).
- **Qué falta**: un lugar para administrar de forma granular lo que se muestra —
  categorías, etiquetas, agrupaciones, formato de fecha, secciones visibles del
  dashboard, tema, densidad, moneda de despliegue preferida, tipos de elemento
  sugeridos.
- **Estado actual**: `usuario.preferencias JSONB` **ya existe** en el esquema
  (DATABASE_DESIGN §87) y `ActualizarDatosUsuario` (#44) ya la acepta (reemplazo
  del objeto completo). DDD Sección B lista "Preferencias globales" como
  responsabilidad del Usuario. El lado de lectura ya está: `GET /usuarios/me`
  devuelve `preferencias`.
- **Recomendación**:
  - Darle forma a `preferencias` (esquema de
    preferencias conocido, con defaults en el cliente).
  - Preferencias **personales** → `usuario.preferencias`. Config **del hogar**
    (categorías, moneda de consolidación, tipos de elemento sugeridos) → tabla
    propia o `hogar` (hoy `hogar` solo tiene `nombre` + `moneda_consolidacion`).
  - Pantalla **Ajustes** con sub-secciones: Perfil · Categorías · Etiquetas ·
    Agrupaciones · Preferencias de visualización · Notificaciones · Hogar.
- **Para decidir**: ¿qué preferencias son del usuario y cuáles del hogar?
  ¿`hogar.configuracion JSONB` o tablas normalizadas?

#### G32 — Evaluación de usabilidad del flujo completo de la app (usuario nuevo)  🟡 PARCIAL (evaluación heurística ✅ y ajustes ✅ 2026-09-29; validación con persona nueva ✅ 2026-09-29, resultado negativo → G33)
- ✅ (2026-09-29) **Revisión heurística** en
  [`Docs/diseño/EVALUACION_USABILIDAD.md`](Docs/diseño/EVALUACION_USABILIDAD.md):
  mapa de navegación real, flujos 1–6 con pasos, 14 hallazgos (4 de severidad
  alta: "Reserva" con dos significados, apartar para una meta en 7 pasos, sin
  lista de cuentas y bienes, onboarding que deja solo al usuario) y propuesta
  de ajustes en 7 puntos.
- ✅ (2026-09-29) **Los 7 puntos de la propuesta aplicados** en la app (detalle
  en `EVALUACION_USABILIDAD.md` §5): vocabulario "Apartado" + glosario,
  "Apartar dinero" en un paso desde el objetivo, detalles conectados, "Mi
  patrimonio", programados y plantillas en Planificar, onboarding que lleva a
  la primera cuenta, y pulido (categoría resuelta, "+" de Planificar,
  engranaje en todas las tabs, icono de Movimientos, fuente de los tipos de
  cambio). Sin cambios de modelo ni migraciones.
- ✅ (2026-09-29) **Validación con persona nueva: falló.** La usuaria no
  completó ningún flujo sola. La navegación (tabs, Ajustes, hogar) se entiende;
  lo que se rompe es la operación (registrar, ahorrar, transferir). Además, el
  punto 2 ("Apartar en un paso") resolvió el caso menos frecuente (ahorro
  virtual): el usuario piensa ahorrar como transferir a la meta. Se continúa en
  **G33**.
- **Qué faltaba**: una evaluación de **todo el flujo gráfico** de la app desde
  el punto de vista de un usuario **nuevo y sin experiencia**: qué tan fácil
  le resulta entender para qué sirve cada sección, cómo se relacionan entre
  sí y cómo sacarle el máximo provecho a la app.
- **Por qué surge** (usuario, 2026-09-27): la app tiene muchas funcionalidades
  útiles, pero incluso quien la modeló y diseñó "cuesta seguirle el paso a las
  secciones" y no se siente que todo esté **conectado** ni que sea
  "facilísimo de usar". Si le cuesta al autor, a un usuario nuevo le va a
  costar más. Las revisiones anteriores de UI/UX (Fase 15,
  `Docs/retirado/UI_UX_BACKLOG.md`, U1–U3) fueron **por pantalla**
  (validación, accesibilidad, listas), no sobre el recorrido completo.
- **Qué evaluar**:
  - **Primer uso / onboarding**: registro → Bienvenida → primer hogar →
    primer elemento → primer movimiento. ¿El usuario sabe qué hacer después de
    cada paso? ¿Entiende los conceptos (elemento patrimonial, reserva,
    asignación, ajuste, valorización…) sin conocer el modelo de dominio?
  - **Mapa de navegación**: tabs, secciones y pantallas de detalle. ¿Hay
    pantallas huérfanas, caminos duplicados o funcionalidades difíciles de
    encontrar? ¿Los nombres de las secciones se entienden para alguien que no
    conoce el modelo?
  - **Conexión entre funcionalidades**: ¿se ve la relación entre elementos,
    movimientos, presupuestos, objetivos/reservas, movimientos programados y
    reportes? ¿Desde una pantalla se llega naturalmente a lo relacionado
    (p. ej. del objetivo a la reserva que lo financia, del presupuesto a los
    movimientos que lo consumen)?
  - **Tareas clave**: medir cuántos pasos y cuánta fricción tienen los flujos
    principales (`UX_FLOWS.md`, flujos 1–6) hechos en la app real.
- **Método sugerido**: recorrido de las tareas clave con alguien que no conozca
  la app (o simulando un usuario novato), un mapa de navegación
  actual y un chequeo contra heurísticas de usabilidad. Resultado: una lista
  priorizada de hallazgos (qué confunde, qué falta conectar, qué simplificar) y
  una propuesta de ajustes al flujo, antes de tocar pantallas.

#### G33 — Rediseño de usabilidad a partir de la prueba con usuaria real  ⬜ PENDIENTE (abierto 2026-09-29; Fase D cerrada 2026-10-02, decisiones D-1 a D-8)
- **Fuente de verdad**: [`Docs/usabilidad/USABILIDAD_REAL_S01.md`](Docs/usabilidad/USABILIDAD_REAL_S01.md)
  (hallazgos HZ-1 a HZ-23, catálogo de 33 escenarios T1/T2/T3, plan por fases
  A–E + BUG-HOG). Continúa G32.
- **Principio**: el dominio no cambia; se rediseña cómo se presentan y encadenan
  las operaciones. Lo que requiera dominio se decide acá.
- **Estado**: Fase A (catálogo) ✅, BUG-HOG ✅, Fase B (recorrido) ✅, Fase C
  (benchmark, [`Docs/usabilidad/BENCHMARK_S01.md`](Docs/usabilidad/BENCHMARK_S01.md)) ✅
  (2026-09-29). Fase D, bloque 1 (decisiones,
  [`Docs/usabilidad/DECISIONES_FASE_D_S01.md`](Docs/usabilidad/DECISIONES_FASE_D_S01.md)) ✅ (2026-09-29).
  Fase D, bloque 2 (prototipo v5; Zoily completó 6 de 6) ✅ y Fase D cerrada
  (2026-10-02, [`Docs/usabilidad/CIERRE_FASE_D_S01.md`](Docs/usabilidad/CIERRE_FASE_D_S01.md)).
  Fase E, en el orden de su §5: bloque 1 (D-4 + HZ-19 + HZ-22, solo frontend)
  ✅ (2026-10-03). Bloque 2 (HZ-3 + HZ-17) ✅: rama `feat/G33-E2-listas`,
  probada por Juan y mergeada a `main` (2026-10-03). Bloque 3 (HZ-24) ✅: rama
  `feat/G33-E3-paso-actual`, probada por Juan y mergeada (2026-10-03).
  Bloque 4 (rediseño visual) ✅: rama `feat/G33-E4-rediseno`, probada por Juan
  y mergeada (2026-10-03). Siguiente: bloque 5 (HZ-13).
- **Bloque 4 de la Fase E — `UI` rediseño visual (✅ mergeado, 2026-10-03)** (insertado el 2026-10-03;
  HZ-13 pasa al bloque 5 y los siguientes se corren uno): la referencia única
  es el prototipo [`Docs/usabilidad/prototipo/prototipo-fase-d-s01.html`](Docs/usabilidad/prototipo/prototipo-fase-d-s01.html).
  Se traducen su estructura, jerarquía y patrones a React Native (no sus
  tamaños ni su CSS): tokens y componentes en `app/src/ui` y después una
  pantalla por commit, sin cambios de lógica ni de API. Si el prototipo
  contradice un hallazgo HZ ya decidido, gana el HZ.
  **Retirada la propuesta C "rimu"** (`Docs/mockup/propuesta-rediseno-C-rimu.html`
  → [`Docs/retirado/propuesta-rediseno-C-rimu.html`](Docs/retirado/propuesta-rediseno-C-rimu.html)):
  era clara visualmente pero poco comprensible; manda el prototipo, que Zoily
  sí completó (6 de 6).
  **Implementado en la rama `feat/G33-E4-rediseno` y probado por Juan en el
  teléfono (2026-10-03):** tokens y componentes (`AmountInput`,
  `AccountList`, `Question`, `Section`, `ListCard`) y una pantalla por commit
  (Registrar movimiento, Inicio, Movimientos, Planificar, Hogar, Agregar
  cuenta o bien, Notificaciones, Metas, Meta, Patrimonio del hogar,
  Movimientos del hogar, Mi patrimonio). Capturas antes/después en
  `Docs/usabilidad/capturas-e4/`. Contradicciones prototipo vs. HZ, resueltas
  a favor del HZ: (1) `Question` conserva el número y el paso actual
  (HZ-19, HZ-24); (2) las cuentas se eligen en la hoja, no en línea (HZ-3);
  (3) se mantienen los términos de D-4 ("¿Desde qué cuenta?", "Saldo
  actual", "Lo que debes hoy") en vez de "¿De dónde sale la plata?" o
  "¿Cuánto tiene hoy?". No se adelantan HZ-21 (hero "Plata del hogar" y
  "Entre [pareja] y tú") ni las puertas por caso del menú (D-8).
  **Ajustes de la primera prueba de Juan (2026-10-03):** botón "Ahorrar" en
  las metas de Inicio (abre la meta; la pantalla de D-1 llega en el bloque 7)
  y montos en negrita (`GoalCard`, `Hero`, `Row`). El menú `+` nuevo sigue
  siendo D-8 (bloque 8).
- **Bloque 2 de la Fase E** (insertado el 2026-10-03, antes de HZ-13; detalle en [`Docs/usabilidad/USABILIDAD_REAL_S01.md`](Docs/usabilidad/USABILIDAD_REAL_S01.md) §4):
  - ✅ `UI` **HZ-3**: toda lista de selección abre una hoja modal (`Elegir` /
    `ElegirVarios` sobre `Select`), sin importar cuántas opciones tenga, por
    homogeneidad; buscador con más de 6. Nunca `SelectRow` apilados. La pantalla
    nunca crece por una lista. **Historia de la solución (2026-10-03):** primero
    se descartó el umbral de 6 opciones en línea (Juan prefirió un solo control
    en toda la app); la original era "scroll
    interno con altura acotada"; se descarta por el scroll anidado en móvil (una
    lista con scroll dentro de una pantalla con scroll). Motivo adicional:
    `Select` ya existe en `app/src/ui`. Se le agregaron buscador, grupos y opción
    "ninguna". Las listas de miembros del hogar (compartir con, designados)
    quedan en línea por ahora.
  - ✅ `UI` **HZ-17**: "Desde qué cuenta" y "A qué cuenta" agrupadas por tipo
    (`app/src/opciones.ts`), en Transferencia también por miembro; "A qué
    cuenta" no repite la de "Desde"; amplía HZ-3.
- **Bloque 3 de la Fase E — `UI` HZ-24 (✅ mergeado, 2026-10-03)**: paso actual
  resaltado y pasos siguientes bloqueados hasta completar el actual; lo hecho
  sigue editable. Reglas: los opcionales nunca bloquean; un paso que ya trae
  valor cuenta como hecho; bloqueado se ve atenuado, no como error. Incluye el
  contraste de los campos editables. Implementado en `contadorPasos` y
  `BloquePaso` (`app/src/ui/index.tsx`); los opcionales posteriores al paso
  actual también se bloquean. No se probó con Zoily: validarlo con ella.
  Detalle en [`Docs/usabilidad/USABILIDAD_REAL_S01.md`](Docs/usabilidad/USABILIDAD_REAL_S01.md) §4.
- **Verificación: transferencia entre miembros registrada por ambos**
  (2026-10-03, `api/test/transferencia-entre-miembros.e2e-spec.ts`). El bug de
  una versión anterior (gastos del hogar inflados) **no existe**: una
  TRANSFERENCIA es un solo evento (REQUISITES §8 y §13) y no suma a ingresos
  ni a gastos en `reporte.service.ts` (`#totalesPorMoneda`, DDD §X.3) ni en
  `presupuesto.service.ts` (`desviacion`); B no puede registrar la misma
  transferencia porque el origen debe ser propio (`evento.service.ts`,
  `exigirPropietario` → 403). **Defecto relacionado que sí existe:** si B
  además anota la plata como INGRESO en su cuenta, los ingresos (y el
  patrimonio) de B y del hogar quedan duplicados en 50.000. El test lo deja
  como `it.fails`. Se corrige con D-8 (bloque 8): en Recibí, "De alguien del
  hogar" no crea evento. Al corregirlo, pasar ese `it.fails` a `it`.
- **Hallazgos del prototipo, pendientes para la Fase E** (detalle en
  [`Docs/usabilidad/CIERRE_FASE_D_S01.md`](Docs/usabilidad/CIERRE_FASE_D_S01.md) §3):
  - `PROYECCIÓN` **HZ-18**: "Libre para gastar" resta el total de deudas por
    plata de terceros (D-3) y avisa cuánta plata ajena hay en las cuentas.
  - `PROYECCIÓN` **HZ-21**: "Entre [pareja] y tú" en Hogar (solicitudes D-7 y
    transferencias entre miembros), solo lectura; no reabre M9/M7.
  - `FLUJO` **HZ-20**: recuperar un ingreso mal clasificado anulándolo y
    registrándolo con D-3 en una sola transacción.
  - ✅ `UI` **HZ-19**: numeración sutil de los pasos de un formulario (bloque 1).
  - ✅ `UI` **HZ-22**: la decisión que cambia el significado del registro va en el
    paso 2 (bloque 1: Ajuste y Nueva meta; Gasté y Recibí llegan con D-8).
  - `UI` **HZ-23**: menú con una puerta por caso → resuelto con D-8.
- **`DOMINIO` pendiente de implementar en la Fase E** (no antes; detalle en
  [`Docs/usabilidad/DECISIONES_FASE_D_S01.md`](Docs/usabilidad/DECISIONES_FASE_D_S01.md) §1):
  - **HZ-11 / D-3 — invariante en la orquestación "Registrar plata de otra
    persona".** `RegistrarElementoPatrimonial` exige `valorPendiente > 0` en
    DEUDA/CREDITO y no mueve plata (M8, M10). Se implementa el servicio de
    aplicación `RegistrarPlataDeOtraPersona`: da de alta la deuda/crédito con
    pendiente 0 y registra la TRANSFERENCIA que la origina en una sola
    transacción, con auditoría encadenada. La invariante admite 0 **solo**
    dentro de esa orquestación; se reutiliza el saldo existente con la misma
    contraparte. Si un movimiento supera el saldo, se salda a 0 y se abre o
    aumenta el opuesto en la misma transacción. Se registra en
    `APPLICATION_SERVICES.md`.
  - **D-5 — relajar G24 (plantillas) y G2 (programados).** Aceptan como destino
    una cuenta de otro miembro con la misma regla de TRANSFERENCIA (G6): nivel
    ≥ "Que puedan transferirme". El origen sigue siendo propio.
  - **HZ-16 / D-6 — campos nuevos en `MovimientoProgramado`:** periodicidad
    (mensual / anual), día y categoría. No se materializa solo: aviso
    "¿Se pagó?", monto ajustable al confirmar, pendiente sin respuesta.
- **Decisiones cerradas** (Fase D, bloque 1, 2026-09-29; ver
  [`Docs/usabilidad/DECISIONES_FASE_D_S01.md`](Docs/usabilidad/DECISIONES_FASE_D_S01.md) §1). Ninguna implementada:
  - ✅ **D-1 — Ahorrar para una meta** (HIP-4): servicio de aplicación
    `AhorrarParaObjetivo`, una transacción y auditoría encadenada, N orígenes;
    si origen = destino, solo reserva. Se registra en `APPLICATION_SERVICES.md`.
  - ✅ **D-2 — Qué compartes con el hogar**: una pregunta con 4 niveles (Nada ·
    Que puedan transferirme · Que vean el saldo y sume al hogar · Todo);
    combinaciones raras en "Avanzado"; por defecto "Que puedan transferirme";
    las cuentas que no calzan se muestran como "Personalizado". Sin cambio de
    dominio (§M se mantiene).
  - ✅ **D-3 — Plata de otra persona** (HIP-2): ver HZ-11 arriba. Puertas: menú
    `+` y "¿Era plata de otra persona?" en Gasto e Ingreso; la persona se elige
    de la lista, nunca por texto libre; un solo saldo con signo en la UI.
  - ✅ **D-4 — Palabras** (HIP-3): diccionario de superficie ("Meta",
    "Ahorrar", "Libre para gastar", "Eliminar"…); se retira "Apartados sin
    objetivo". Los comandos mantienen su nombre. **Implementada** en la Fase E,
    bloque 1 (2026-10-03); los sueltos existentes se ven como "Ahorro sin meta".
  - **Residuo de D-4: errores del backend sin código** (solo texto; la app no
    los puede traducir). Pendientes para los bloques 7 u 8 de la Fase E:
    "Objetivo no encontrado", "El objetivo no es tuyo", "No puedes modificar
    este objetivo", "El objetivo no está compartido con un hogar", "El objetivo
    ya tiene ese estado", "Solo el dueño puede compartir/eliminar el objetivo",
    "Hay un objetivo repetido en las líneas", "Un objetivo no existe o no está en
    el alcance del presupuesto", "Asignación no encontrada", "La asignación no
    es tuya", "Reserva no encontrada", "La reserva no está activa", "El elemento
    financia reservas activas", "El elemento solo tiene $X disponible", "El
    origen y el destino no pueden ser el mismo", "Origen y destino no pueden ser
    el mismo elemento", "Origen y destino son la misma moneda", "No eres
    propietario del elemento origen", "No puedes mover fondos a ese elemento
    destino", "El evento/ajuste/movimiento ya está anulado", "La valorización ya
    está anulada", "No se puede corregir un evento/ajuste/valorización
    anulado(a)" y las validaciones técnicas "… requiere elementoOrigenId…".
    Camino propuesto: que el backend devuelva un código y la app lo traduzca.
  - ✅ **D-5 — Destino de otro miembro** en plantillas y programados: ver arriba.
  - ✅ **D-6 — Recurrencia** (HZ-16): ver arriba. Las plantillas se muestran
    como "Frecuentes".
  - ✅ **D-7 — Solicitud de aporte** (M7): notificación con acción, tipo nuevo
    `SOLICITUD_APORTE`; comandos intactos.
  - ✅ **D-8 — Dos puertas y "¿de quién es?"** (HZ-23; cierre de la Fase D,
    2026-10-02, [`Docs/usabilidad/CIERRE_FASE_D_S01.md`](Docs/usabilidad/CIERRE_FASE_D_S01.md) §4): el menú `+` tiene una
    puerta por dirección de la plata y el paso 2 de Gasté y Recibí pregunta de
    quién es (Mío · Compartido con el hogar · De otra persona / Mía · De
    alguien del hogar · De otra persona). Reemplaza las puertas de D-3 y la de
    "Gasto compartido". Sin dominio nuevo. **Riesgo aceptado (Juan):** no se
    probó con una usuaria sin contacto previo; se valida en la app real con la
    señal de la Fase E. **Reapertura:** si se suma un usuario nuevo, se repiten
    con él las pruebas 4 y 6.
- **Fuera de alcance: M9/M7 — atribución del gasto por persona.** El modelo ya
  hace cuadrar los saldos individuales y el total del hogar; en "Míos" el gasto
  completo aparece en quien pagó. **Reapertura:** solo si en la Fase E Zoily o
  Juan reportan que sus números personales no calzan (camino barato: etiqueta
  informativa sin tocar saldos). Ver [`Docs/usabilidad/DECISIONES_FASE_D_S01.md`](Docs/usabilidad/DECISIONES_FASE_D_S01.md) §3.

---

# Parte 2 · Implementado / decisión cerrada

## 2.1 Historial del plan de trabajo

### Chico, sin decisión — Fase 36

| # | Gap | Qué se hizo | Estado |
|---|-----|-------------|--------|
| P1 | **G3** | Moneda de consolidación en "Crear hogar" + "Gestionar hogar". | ✅ Fase 36 |
| P2 | **G14** | Al **anular** un evento que consumió reservas, devolverlas a ACTIVA. | ✅ Fase 36 |
| P3 | **G11** | Comando `CambiarAdmiteValorizacion` + toggle en "Editar elemento". | ✅ Fase 36 |
| P4 | **G20** | Preferencias de notificación (silenciar tipos) en "Mi perfil". | ✅ Fase 36 |

### Mediano, con decisión tomada — Fases 37–45 (2026-09-05)

| # | Gap | Decisión y qué se hizo | Estado |
|---|-----|------------------------|--------|
| P5 | **G9** | "Se pueden corregir más datos": `CorregirEventoFinanciero` acepta `nuevaFecha` y `nuevaGlosa` además del monto. Cadena sigue lineal (re-corregir encadenando quedó fuera — bajo valor, más riesgo). | ✅ Fase 38 |
| P6 | **G26 / G15 / B7** | "Sí": migración 019 `presupuesto_linea_ahorro`; comando `DefinirLineasAhorroPresupuesto`; `desviacion.porObjetivo[]`. La suma de líneas vs. `gastos_esperados` queda como señal informativa, no bloqueo. | ✅ Fase 41 |
| P7 | **B9 (dentro de G23)** | "Sí, jerárquicas generales y que el usuario pueda crearlas": migración 017 `categoria_padre_id` (2 niveles); alta inline "¿no la encuentras?". | ✅ Fase 39 |
| P8 | **G17** (intereses) | "Lo que tenga menos fricción": el interés se registra como **Ajuste Patrimonial** (sin migración ni comando nuevo). Atajo "Registrar interés" con monto sugerido. | ✅ Fase 37 |
| P9 | **G13 / B6** | "Debe poder seleccionarse y formar parte de una vista hogar; todos ven, los designados modifican, el admin asigna": migración 021 `objetivo_financiero.hogar_id` + `objetivo_designado`; comandos `CompartirObjetivoConHogar` / `DefinirDesignadosObjetivo`. | ✅ Fase 43 |
| P10 | **G18 / B10** | "Sí": migración 020 `fecha_alta` / `fecha_baja`; la reconstrucción usa la ventana de existencia. Fecha a la anulación queda fuera (más complejo, poco valor). | ✅ Fase 42 |
| P11 | **G16 / B8** | "Debería pero solo afecta a ese elemento, no ramificarse": migración 022 `moneda` en objetivo/asignación/presupuesto como **etiqueta** (sin conversión). La reserva usa la del elemento. | ✅ Fase 45 |
| P12 | **G6** (resto) / **G2** (resto) | "Sí": co-propiedad estricta (un co-propietario debe compartir hogar). El resto quedó cubierto por P9 (objetivos del hogar visibles) + el alcance FAMILIAR de presupuestos; la visibilidad del movimiento programado sigue heredada del elemento (decisión G2). | ✅ Fase 44 |
| P13 | **G7 / G19** | "De acuerdo" con lo provisional: proyecciones todas en vivo (no se materializan); sin `elemento.hogar_consolidacion_id` (multi-hogar descartado). Nada que hacer salvo que aparezca un problema de performance. | ✅ (sin trabajo) |

**Además (pedido 2026-09-05)**: catálogo configurable de **tipos de elemento
patrimonial** por hogar (migración 018, módulo `tipo-elemento/`) con alta inline
y pantalla en Configuración; la vista **Configuración** se consolidó como hub
único (Fase 46).

### Despliegue y cuenta

| # | Qué | Estado |
|---|-----|--------|
| P17 | **Hospedar el backend**: Expo (local) → Render (NestJS) → Neon (PostgreSQL), $0/mes. Pasos, `render.yaml` y checklist en **`Docs/DESPLIEGUE.md`**. | ✅ en producción (verificado 2026-09-27) |
| P18 | **G31** — Recuperación de contraseña olvidada. Decidido (a) reset propio vía email + `usuario.token_version` (un solo uso + cierra sesiones). Hecho y verificado en prod (2026-09-27). Mejora de UX: código de 6 dígitos (también en el registro, G4) — migración 026, 2026-09-29. | ✅ RESUELTO |

### Tanda GAPS Parte 1 — 2026-09-29

Orden acordado: del más simple al más complejo. Commit `7b4e443`, en `main`
desplegado en Render después de aplicar la migración 026 en Neon (2026-09-29).

| # | Gap | Decisión y qué se hizo | Estado |
|---|-----|------------------------|--------|
| 1 | **G31** | Código de 6 dígitos en vez del JWT: tabla `codigo_verificacion` (migración 026), HMAC, 15 min, 5 intentos. | ✅ |
| 2 | **G4** | Mismo mecanismo para el registro: `POST /auth/verificar-codigo-registro` canjea el código por el token. | ✅ (captcha sigue 🔒) |
| 3 | **G25** | Preferencias v1 en `usuario.preferencias.visualizacion`; lo del hogar se queda en sus tablas. Densidad pendiente. | 🟡 |
| 4 | **G14** | Consumo parcial: se divide la reserva (sin migración). | ✅ |
| 5 | **G11** | Anular/corregir intermedias: impacto compensatorio en la siguiente (`valorizacion` sigue inmutable). | ✅ |
| 6 | **U3** | Se deja diferido a propósito (aporta poco). | — |

**Siguiente tanda** (necesita decisión del usuario): G32 (¿revisión heurística
propia o prueba con alguien nuevo?) → G21 (¿mindicador.cl? ¿cron de Render o
`@nestjs/schedule`?) → captcha G4 (¿Turnstile o hCaptcha? + claves) → push G20
(cuenta EAS + `projectId` + teléfono físico).

### Tanda GAPS Parte 1 (b) — 2026-09-29

Decisiones del usuario: G32 por revisión heurística propia; G21 con
mindicador.cl + `@nestjs/schedule`; captcha (G4) y push remoto (G20) pospuestos.

| # | Gap | Decisión y qué se hizo | Estado |
|---|-----|------------------------|--------|
| 1 | **G32** | Revisión heurística: `Docs/diseño/EVALUACION_USABILIDAD.md` (mapa, flujos, 14 hallazgos, propuesta). | 🟡 (ajustes pendientes) |
| 2 | **G21** | Importación de USD/EUR/UF→CLP desde mindicador.cl al arrancar y cada hora; env `TIPOS_CAMBIO_IMPORTACION`. Sin migración. | ✅ |
| 3 | **G4** captcha | Pospuesto. | 🔒 |
| 4 | **G20** push | Pospuesto (EAS + teléfono físico). | 🔒 |

**Siguiente tanda**: aplicar G32 puntos 1, 3, 6 y 7; decidir G32 puntos 2 y 4.

### Tanda GAPS Parte 1 (c) — 2026-09-29

Decisiones del usuario: G32 punto 2 sí ("Apartar dinero" en un paso), punto 4
como pantalla "Mi patrimonio" (no una 5.ª tab), punto 5 sí (programados a
Planificar).

| # | Gap | Qué se hizo | Estado |
|---|-----|-------------|--------|
| 1 | **G32** | Los 7 puntos de la propuesta, solo en la app (+ el texto de la notificación `RESERVA_CONSUMIDA`). Ver `EVALUACION_USABILIDAD.md` §5. | ✅ (falta validar con una persona) |

**Siguiente**: probar el flujo con una persona nueva; captcha G4 y push G20 siguen pospuestos.

### Pulido de UI — Fase 53

| # | Qué | Estado |
|---|-----|--------|
| U1 | **H3** — validación en vivo (`error?` + `intento`) en los formularios que faltaban | ✅ Fase 53 |
| U2 | **I1** — `accessibilityRole/Label/State` en los `Pressable` sueltos | ✅ Fase 53 |

## 2.2 Detalle por tema

### Tema A · Cuenta y autenticación

#### G31 — Recuperación de contraseña olvidada (login)  ✅ RESUELTO (verificado en prod 2026-09-27; código de 6 dígitos ✅ 2026-09-29)
- **Qué falta**: no existe ningún mecanismo para que un usuario recupere el
  acceso si olvida su contraseña. `POST /auth/login` (`api/src/auth/auth.controller.ts`)
  es el único endpoint de autenticación además de `POST /auth/registro-token`
  (que solo sirve para verificar el email al registrarse, ver G4). Hoy, un
  usuario bloqueado solo puede recuperarse con una intervención manual directa
  sobre `usuario.password_hash` en la base de datos.
- **Por qué no está resuelto**: ni el DDD ni API_DESIGN contemplaron el login
  como parte del dominio (`auth.service.ts` lo dice explícitamente:
  "Autenticación — infraestructura, no dominio") — el flujo de recuperación
  quedó fuera del alcance original y no se había detectado hasta una revisión
  de seguridad (sesión 2026-09-16).
- **Opciones evaluadas**:
  - (a) **Reset propio vía email** — mismo patrón que el token de registro (G4):
    `POST /auth/solicitar-reset-password { email }` emite un JWT de propósito
    acotado (`purpose: 'reset'`, vida corta) enviado por `EmailSender`;
    `POST /auth/reset-password { token, nuevaPassword }` lo valida y actualiza
    `password_hash`. Bajo esfuerzo (reutiliza infraestructura existente:
    `EmailSender`, `hashPassword`, patrón de JWT de propósito acotado), pero
    sigue siendo seguridad de credenciales mantenida a mano — sin invalidación
    de un solo uso salvo que se agregue una tabla de tokens consumidos.
  - (b) **Externalizar el login** (Auth0 / Clerk / Supabase Auth / Cognito /
    Firebase Auth) — el proveedor resuelve reset, verificación de email y MFA
    de fábrica. Costo: mapear el `sub` externo a `usuario.id`, reescribir
    `JwtAuthGuard` para verificar JWKS del proveedor en vez del HS256 propio, y
    mover `RegistrarUsuario` / `registro-token` (G4) a los hooks del proveedor.
    Migrar ahora (antes de tener usuarios reales en prod — ver P17, despliegue)
    es más barato que después.
- **Recomendación**: (a) para no bloquear el despliegue — cierra el gap crítico
  con cambios acotados; evaluar (b) más adelante si se quiere sumar MFA/login
  social o dejar de mantener credenciales propias.
- **Para decidir**: ¿(a) o (b)? Si es (a): ¿el token de reset es de un solo uso
  (requiere tabla) o basta con la ventana corta de expiración, como en G4?
  ¿se invalidan las sesiones (JWT de 7 días) ya emitidas al resetear la
  contraseña?
- **Decisión (2026-09-26)**: **(a) reset propio vía email.** (b) queda para
  cuando se quiera MFA o login social. Las dos preguntas abiertas se resuelven
  con una sola columna, `usuario.token_version` (migración 025):
  - `POST /auth/solicitar-reset-password { email }` → siempre `{ enviado: true }`
    (no revela si el email existe); si hay un usuario ACTIVO, envía por
    `EmailSender` un JWT `purpose: 'reset'` de 30 min con `tv = token_version`.
    El token nunca viaja en la respuesta, ni en dev. Rate-limit: 10/h por IP y
    3/h por email.
  - `POST /auth/reset-password { token, nuevaPassword }` → valida el token y
    actualiza `password_hash` e incrementa `token_version` en un solo `UPDATE`
    filtrado por `tv`, así el token es **de un solo uso** sin tabla aparte (y
    atómico ante dos requests simultáneos).
  - **Sesiones invalidadas**: el JWT de sesión lleva `tv` y `JwtAuthGuard` lo
    compara contra `usuario.token_version` (una lectura por request). Además,
    el guard ahora rechaza tokens con `purpose` (registro/reset), que antes
    eran aceptados como sesión por firmarse con el mismo secreto.
  - Tests: `api/test/reset-password.e2e-spec.ts`.
  - App: link "¿Olvidaste tu contraseña?" en Login → `RecuperarPasswordScreen`
    (email → código + nueva contraseña → volver a Login).
  - Migración 025 aplicada en Neon (2026-09-26).
  - Email real: **Brevo** (sin dominio propio — remitente = un email verificado
    en Brevo; 300/día gratis). `BrevoEmailSender` (fetch a su API, sin SDK) se
    activa con `BREVO_API_KEY` + `EMAIL_REMITENTE`; sin ellas, consola. Un fallo
    de envío en el reset se loguea y no se propaga (un 500 solo para emails
    existentes delataría la cuenta). Compartido con G4.
  - Brevo configurado en Render (`Docs/DESPLIEGUE.md` §2b). **Verificado en
    prod (2026-09-27)**: el email llega, el reset vuelve a Login y se entra con
    la nueva contraseña.
- **Mejora de UX ✅ (2026-09-29, migración 026)**: el "código" que se pegaba era
  el JWT completo (~250 caracteres). Ahora es un **código de 6 dígitos**, igual
  para el registro (G4). Tabla `codigo_verificacion` (PK email + propósito
  `REGISTRO`/`RESET`, tabla aparte porque en el registro aún no existe el
  usuario): guarda un HMAC del código (clave `JWT_SECRET`), vence a los
  **15 min** y admite **5 intentos** (el intento se suma en el mismo `UPDATE`
  que filtra vigencia y tope; acertar borra la fila filtrando por hash → un solo
  uso atómico). Pedir otro código reemplaza al anterior.
  `POST /auth/reset-password` ahora recibe `{ email, codigo, nuevaPassword }`
  (el `token_version` sigue cerrando las sesiones). App: campo numérico de 6
  dígitos con autocompletado de código único. Tests en
  `reset-password.e2e-spec.ts` y `api-idempotencia-registro.e2e-spec.ts`.
  Opciones que se evaluaron:
  - **Código corto** (6 dígitos): guardar su hash + expiración + intentos en
    una tabla (o columnas en `usuario`), con tope de intentos para que no se
    pueda adivinar por fuerza bruta. Es el cambio más directo para el usuario.
  - **Deep link** (descartado por ahora): el email trae un link `patrimonia://reset?token=…` que abre
    la pantalla con el token ya cargado — el usuario no copia nada, pero
    requiere configurar el scheme/universal links en la app.
- **Nota**: sin dominio propio los correos pueden caer en spam; si hay dominio,
  autenticarlo en Brevo (SPF/DKIM) y cambiar `EMAIL_REMITENTE`.

### Tema B · Hogar, membresías y consolidación

#### G3 — `moneda_consolidacion` en CrearHogar  ✅ RESUELTO (Fase 36, P1)
- "Crear hogar" ahora pide la moneda (`Select`, default CLP) y la manda en
  `monedaConsolidacion`; "Gestionar hogar" tiene un panel para cambiarla
  (`CambiarMonedaConsolidacion` #36, solo admin) con aviso de que no recalcula lo
  ya mostrado.
- **Qué falta**: el esquema exige `hogar.moneda_consolidacion` (NOT NULL), pero
  el comando `CrearHogar` (API_DESIGN A / AS #34) solo define `nombre` como input,
  y la pantalla "Crear Hogar" (UX_FLOWS) solo pide el nombre.
- **Decisión provisional**: el DTO acepta `monedaConsolidacion` opcional; si no
  viene, se usa el placeholder `"CLP"` (`MONEDA_PLACEHOLDER` en `hogar.service.ts`).
  Ajustable después con `CambiarMonedaConsolidacion` (AS #36, aún no implementado).
- **Por qué es aceptable**: es el mismo patrón que BUILD_INSTRUCTIONS §4 autoriza
  para el % de Deuda/Crédito — placeholder trivial + comentario en código.
  Bloquear todo el flujo vertical por la moneda inicial sería desproporcionado.
- **Para decidir**: ¿la pantalla de alta debería pedir la moneda?, ¿o el default
  es una regla de producto legítima ("hogar chileno → CLP")?

#### G5 — Consulta "mis invitaciones recibidas"  ✅ RESUELTO
- **Qué falta**: la pantalla del invitado (UX_FLOWS Flujo 2, paso 4) necesita
  listar sus invitaciones pendientes, pero no conoce el `hogar_id`. API_DESIGN
  solo tiene `GET /hogares/{id}/invitaciones?estado=PENDIENTE` (por hogar).
- **Decisión**: se agregó `GET /usuarios/me/invitaciones?estado=PENDIENTE`,
  simétrico a `GET /usuarios/me/hogares` que sí existe.
- **Por qué es aceptable**: API_DESIGN § "Resumen de cobertura" dice que las
  consultas "no se cuentan 1:1 contra ningún catálogo... se diseñaron según
  necesidad de UI/dashboard razonable". No es un comando ni una regla nueva.

#### G12 — Fase 5b: comandos de ciclo de vida — detalles  ✅ DECISIÓN CERRADA (decisiones documentadas)
- `CambiarMonedaConsolidacion` (#36) cambia el campo pero **no recalcula
  consolidaciones** en la nueva moneda (W) — no hay proyección de consolidación
  ni tipos de cambio (ver G7).
- `EliminarHogar` (#42) hace **delete físico** de hogar + membresías +
  invitaciones. El registro de "quién estuvo" queda solo en `auditoria`
  (`valor_anterior.miembros_desvinculados`).
- `RemoverMiembro` / `SalirDeHogar` marcan `membresia.estado = 'SALIDA'`
  (conservan la fila).
- `EliminarElementoPatrimonial` (#9) solo si el elemento no tiene ningún
  `impacto_patrimonial` ni reserva. `CorregirDatosElementoPatrimonial` (#3) es
  un `UPDATE` idéntico a #2 con `comando` distinto + motivo (la config no es
  hecho económico; su historial vive en auditoría — DATABASE_DESIGN §3).

#### G19 — Consolidación del hogar sin `hogar_id` en el elemento (Fase 10)  ✅ DECISIÓN CERRADA (P13: sin `hogar_consolidacion_id`; multi-hogar descartado)
- **Qué falta**: DDD Sección Q dice "un elemento participa en una única
  consolidación de hogar", pero el esquema solo tiene el booleano
  `participa_consolidacion` — no hay columna que apunte a qué hogar.
- **Decisión provisional (Fase 10)**: un elemento con `participa_consolidacion =
  true` entra en la consolidación de **todo hogar** donde alguno de sus
  propietarios sea miembro ACTIVA. En el caso normal (un hogar por usuario) es
  exacto; con multi-hogar un elemento podría contarse en dos consolidaciones.
- **Otras decisiones de Fase 10**:
  - El elemento se suma **una vez por su `valor_vigente` completo** (no ponderado
    por %) — Sección Q: "no debe duplicar elementos compartidos".
  - **Sin total entre monedas** (G7): desglose `porMoneda`.
  - Pasivos = categoría `DEUDA` (magnitud); `CREDITO` es activo.
  - "Avance de objetivos del hogar" agrega los objetivos personales de todos los
    miembros ACTIVA (los objetivos siguen siendo personales, G13).
  - `GET /hogares/:id/eventos-financieros` (no `?hogar=` como en API_DESIGN):
    una fila por evento (colapsa transferencias) con `montoEfectivo` neto de
    correcciones vivas (colapsa el par original+compensatorio).
- **Para decidir**: ¿`elemento.hogar_consolidacion_id` explícito?

#### G30 — Cierre de los hallazgos del análisis de dominio  ✅ RESUELTO (Fase 52)

Hallazgos F4/F6/F7/F8 de `Docs/mockup/casos-dominio-probados.html` (F1/F2/F3/F5
ya cerrados en Fases 50–51).
- **F6/F7 — REQUISITES §K, punto 13** ("la transferencia como un único movimiento en
  la vista consolidada"): el feed `/hogares/:id/eventos-financieros` ya existía
  pero (a) ninguna pantalla lo usaba y (b) devolvía movimientos de cuentas
  PRIVADAS de otros miembros. Ahora `ConsolidacionService.eventosDelHogar`
  **filtra por §M**: solo eventos que tocan un elemento con
  `participa_consolidacion` o de propiedad del actor. Se añadió `glosa` y los
  `elementos` pasan a `{id, nombre}[]`. Pantalla nueva **`MovimientosHogar`**
  (link en Hogar → Patrimonio): una fila por evento, la transferencia colapsada
  y neutra. El feed ampliado (objetivos, miembros, valorizaciones) queda fuera
  por decisión — necesitaría un endpoint agregado sobre `auditoria`.
- **F4 — guía a Crédito/Deuda** (UX_FLOWS Flujo 1, nota del paso 6): al registrar
  un INGRESO, un aviso — "¿te lo devuelven / es de un tercero?" — con enlace a
  crear un Crédito/Deuda (`AgregarElemento` acepta `?categoria=`).
- **F8 — compra co-financiada**: solo guía UX (elección del usuario), sin cambio
  de modelo. Al registrar un GASTO, aviso: "¿alguien más aportó? Registra primero
  una transferencia desde su cuenta a la tuya y luego el gasto completo". El neto
  ya cuadra con ese patrón; un GASTO con aportes de varias cuentas/personas
  seguiría siendo una decisión de dominio pendiente si algún día se pide.

### Tema C · Elementos patrimoniales y visibilidad

#### G6 — Visibilidad de elementos y propiedad compartida (Fase 2)  ✅ RESUELTO (§B1 Fase 34; co-propiedad estricta Fase 44, P12)
- **Qué falta**: el DDD (Sección M) define visibilidad "por tipo de información"
  (existencia, valor, movimientos, reservas...). El esquema colapsó eso a un solo
  enum `visibilidad` (PRIVADA/COMPARTIDA/FAMILIAR). No hay tabla "compartido con
  quién", así que COMPARTIDA y FAMILIAR se tratan igual.
- **Decisión provisional (Fase 2)**:
  - `GET /elementos-patrimoniales/:id` y `/impactos`: visibles para los
    propietarios; y para co-miembros de hogar si `visibilidad != PRIVADA`.
  - `GET /elementos-patrimoniales?propietario=X`: solo `X = actor`.
  - `RegistrarEventoFinanciero` TRANSFERENCIA: el actor debe ser propietario del
    origen; el destino debe ser propio o de un co-miembro de hogar.
  - `RegistrarElementoPatrimonial`: el actor debe figurar entre los propietarios
    declarados (no puede crear un elemento 100% ajeno). Cualquier co-propietario
    debe ser un usuario ACTIVO — no se exige (todavía) que comparta hogar.
- **RESUELTO (Fase 34, §B1)**: migración 016.
  - `elemento_visibilidad(elemento_id, tipo_info, nivel)` — nivel por tipo
    (EXISTENCIA / VALOR / MOVIMIENTOS). Fila solo si sobrescribe el enum base
    `visibilidad` (que sigue siendo el nivel por defecto de todos los tipos).
  - `elemento_comparticion(elemento_id, usuario_id)` — con quién se comparte
    cuando el nivel es COMPARTIDA. **Compat**: COMPARTIDA sin lista se comporta
    como FAMILIAR (los elementos previos no cambian).
  - Comando `DefinirVisibilidadElementoPatrimonial {elementoId, niveles?, compartidoCon?}`.
  - `elemento.service.#puedeVer(el, actor, tipo)`. `obtenerElemento` cierra
    EXISTENCIA (404) y, sin VALOR, devuelve `valorOculto: true` + montos en 0.
    `evento.service.listarPorElemento` abre a co-miembros con MOVIMIENTOS.
  - `GET /elementos-patrimoniales?alcance=hogar` — elementos de co-miembros cuya
    existencia el actor puede ver (desbloquea §A8: transferir a su elemento).
- **Fase 44 (P12)**: co-propiedad **estricta** — un co-propietario debe compartir
  al menos un hogar ACTIVA con el actor (`elemento.service.#exigirCopropietariosDelHogar`),
  tanto al registrar como al `CambiarPropiedadElementoPatrimonial`.
- **Fase 43 (P9)**: los objetivos pueden compartirse con un hogar (visibles para
  sus miembros). Presupuestos FAMILIAR ya eran visibles al hogar. Las reservas
  siguen la visibilidad de su asignación/objetivo.
- **Cubierto por decisión**: la visibilidad propia del movimiento programado se
  mantiene heredada del elemento (DDD §S / G2).

#### G11 — Valorización: cadena lineal y `admite_valorizacion` (Fase 4)  ✅ RESUELTO (`admite_valorizacion` ✅ Fase 36; anular/corregir intermedias ✅ 2026-09-29)
- ✅ (Fase 36, P3) Comando `CambiarAdmiteValorizacion {elementoId, admite}` —
  toggle en "Editar elemento", rechaza habilitar en DEUDA/CREDITO.
- ✅ (2026-09-29) **Anular/corregir valorizaciones intermedias, re-encadenando.**
  La valorización es un reemplazo (stock): la siguiente vigente de la cadena
  fija el valor desde su fecha. Entonces, al anular o corregir una intermedia,
  **`valor_vigente` no cambia** y la siguiente absorbe la diferencia; solo el
  historial entre ambas cambia. Como `valorizacion` es inmutable (salvo
  `anulada`), el re-encadenamiento **no** reescribe su `valor_anterior` (que
  queda como "el valor al registrarla"): se agrega un **impacto compensatorio**
  ligado a la siguiente (misma fecha, `origen_id` = la siguiente). Por eso el
  delta efectivo de una valorización es la **suma de sus impactos**, y eso es lo
  que se descuenta al anularla.
  - Cadena: vigentes por fecha, con cada corrección justo después de su original
    (`valorizacion.service.#siguienteEnCadena`).
  - Si es la última, `valor_vigente −= delta` (corregir: `+=`). Antes se volvía a
    `valor_anterior` / se fijaba el valor corregido, lo que borraba los
    movimientos o ajustes registrados después de la valorización.
  - Sigue sin poder anularse/corregirse una valorización con una corrección
    vigente (se actúa sobre la corrección). La auditoría guarda
    `reencadenada_id`. Tests: `flujo3-valorizacion.e2e-spec.ts`.
  - App: "Corregir" / "Anular" disponibles en cualquier valorización vigente sin
    corregir; el aviso de anulación explica si el valor actual cambia o no.
- **Qué falta**: AS #18 dice que la cadena de valorizaciones "debe ser
  recorrible en orden" pero no acota cuál se puede anular.
- **Decisión provisional (Fase 4, reemplazada 2026-09-29)**: solo se podía
  **anular o corregir la última valorización vigente** del elemento (igual que G9
  para eventos).
  `AnularValorizacion` **elimina** el impacto asociado (DDD #18 dice "eliminar",
  y el esquema no tiene flag en `impacto_patrimonial`).
- **`admite_valorizacion`**: se fija al crear el elemento
  (`RegistrarElementoPatrimonial`; la app lo activa por defecto para categorías
  ACTIVO / INVERSION) y se cambia después con `CambiarAdmiteValorizacion`
  (Fase 36, ver arriba).

#### G18 — Reconstrucción histórica: sin fecha de alta ni de baja (Fase 9)  ✅ RESUELTO (Fase 42, P10 — fecha_alta/fecha_baja; fecha de anulación descartada)
- **Qué falta**: DDD Sección V pide reconstruir el estado a una fecha pasada
  aplicando los hechos con `fecha <= X`. El modelo no guarda "fecha de alta" ni
  "fecha de baja" del elemento (Registrar/Desactivar/Reactivar son config, y la
  Sección V dice que la auditoría no participa).
- **Decisión provisional (Fase 9)**:
  - La reconstrucción retrocede desde `valor_vigente` restando los impactos con
    `fecha > X` (columna `impacto_patrimonial.fecha`, migración 004).
  - Para fechas anteriores a toda actividad devuelve el **valor inicial** del
    elemento — no distingue "no existía todavía".
  - Usa el `estado` ACTIVO/INACTIVO **actual** (un elemento hoy inactivo no
    aparece en el patrimonio histórico aunque estuviera activo en X).
  - Un evento hoy anulado se considera inexistente en toda la línea de tiempo
    (la anulación no tiene fecha de hecho económico).
- **Para decidir**: ¿agregar `fecha_alta` / `fecha_baja` al elemento? ¿fecha a la
  anulación para reconstruirla en el tiempo?

#### G29 — El saldo inicial de una cuenta como hecho económico  ✅ RESUELTO (Fase 51)
- **Qué faltaba**: al crear una cuenta LIQUIDEZ/RESERVA con `valorInicial`, ese
  monto solo inicializaba `valor_vigente` — no era un evento, así que el reporte
  del mes mostraba solo el flujo posterior (crear una cuenta con 1.000.000 y
  gastar 250.000 daba "balance del mes: −250.000"). El usuario lo reportó como
  defecto: quiere que la apertura cuente como ingreso del mes.
- **Decisión (Fase 51, elección del usuario)**: `RegistrarElementoPatrimonial`,
  **solo** para categoría LIQUIDEZ o RESERVA con `valorInicial > 0`, crea también
  un `evento_financiero` de tipo **`SALDO_INICIAL`** (migración 024 amplía el
  CHECK de `evento_financiero.tipo`) + su `impacto_patrimonial` (`+valorInicial`,
  fecha = `fecha_alta`), en la misma transacción. El elemento nace en 0 y el
  impacto lo lleva a su valor → la reconstrucción histórica queda 100 % basada en
  impactos para estas cuentas. INVERSION/ACTIVO **no** lo generan (un inmueble o
  un fondo no es "ingreso del mes").
- **Efecto en las lecturas**:
  - `resumen-financiero`: `SALDO_INICIAL` suma a `porMoneda.ingresos`/`balance` y
    aparece en `porRubro` como un rubro propio "Saldo inicial". En `movimientos`
    sale como fila con `glosa: 'Saldo inicial'`.
  - **Presupuesto**: NO cuenta como ingreso real del período (abrir una cuenta no
    es ingreso presupuestable) — `presupuesto.service` solo mira INGRESO/GASTO.
  - `patrimonio-individual` / reconstrucción: sin cambio de valor final.
- **Restricciones**: no se puede crear a mano (`SALDO_INICIAL` no está en
  `TIPOS_EVENTO`), ni anular ni corregir (usar un Ajuste Patrimonial sobre la
  cuenta). App: la vista Movimientos se unificó en un solo selector de período
  (Mes / Año / Recientes) que muestra KPIs + lista juntos, y agrega
  "Disponible hoy" (líquido real) para el alcance propio.

### Tema D · Deuda / Crédito

#### G1 — Estado operativo intermedio de Deuda/Crédito  ✅ RESUELTO (Fase 32)
- **Qué falta**: un valor entre "activa" y "pagada por completo" para mostrar en UI.
- **Por qué no está resuelto**: la Sección T del DDD dice que el estado "se deriva
  del valor pendiente" pero no enumera los valores intermedios.
- **Decisión (Fase 8)**: NO se introduce un estado formal nombrado. […]
- **Decisión (Fase 32, §B2 de DOMINIO_PENDIENTE)**: el usuario pidió incluir los
  conceptos. Sigue **sin columna** `estado_operativo` — es un **cálculo de lectura**
  fiel al DDD, expuesto en `ElementoPatrimonialDTO.estadoOperativo`:
  `VIGENTE` · `PARCIALMENTE_PAGADA` (pendiente < pendiente inicial) · `EN_MORA`
  (`fecha_termino` pasada y pendiente > 0) · `SALDADA` (pendiente 0) · `CONDONADA`
  / `INCOBRABLE` (pendiente 0 + impacto CONDONACION / DECLARACION_INCOBRABLE).
  Migración 014 agregó `valor_pendiente_inicial` para no depender de la auditoría.
  `elemento.service.#estadoOperativoDeuda`.

#### G-J — Información adicional de Deuda/Crédito (REQUISITES §J)  ✅ RESUELTO (Fase 32)
- **Qué faltaba**: acreedor/deudor, fecha inicio/término, cuota, tasa de interés,
  observaciones — todos **opcionales** (REQUISITES §J).
- **Decisión (§B3 de DOMINIO_PENDIENTE)**: columnas nullable en
  `elemento_patrimonial` (migración 014), no tabla hija — mismo patrón que
  `valor_pendiente`. Se capturan en `RegistrarElementoPatrimonial` y se editan con
  `ActualizarDatosElementoPatrimonial` / `CorregirDatosElementoPatrimonial`
  (`#editarCampos` extendido). Solo se persisten/leen para categoría DEUDA/CREDITO.

#### G17 — Deuda/Crédito: signo del valor_vigente y relación con valor_pendiente (Fase 8)  ✅ RESUELTO (intereses vía Ajuste, Fase 37, P8)
- Signo, invariante y pago-por-transferencia: ✅. Abierto (📋): ¿intereses como
  Ajuste o como evento propio? (con §B3 ya está el campo `tasa_interes`).
- **Qué falta**: ni el DDD ni DATABASE_DESIGN fijan el signo de
  `elemento_patrimonial.valor_vigente` para una DEUDA, ni cómo se relaciona con
  `valor_pendiente` cuando cambian por evento/ajuste.
- **Decisión provisional (Fase 8)**:
  - **DEUDA** → `valor_vigente` **negativo** (arrastra el patrimonio hacia abajo);
    **CREDITO** → `valor_vigente` positivo. En ambos, magnitud = `valor_pendiente`.
  - `RegistrarElementoPatrimonial` para DEUDA/CREDITO exige `valorPendiente > 0`,
    ignora `valorInicial` y deriva el `valor_vigente` con signo. No admite
    valorización.
  - **Invariante `valor_pendiente == |valor_vigente|`**: se mantiene con la
    política muda `derivarValorPendiente` (`src/common/deuda.ts`), llamada tras
    cada impacto en `RegistrarEventoFinanciero` / `AnularEventoFinanciero` /
    `CorregirEventoFinanciero` / los tres comandos de Ajuste. Sin entrada de
    auditoría propia (DDD Sección U: política 1-a-1 y muda).
  - Pagar una deuda / cobrar un crédito se modela como **TRANSFERENCIA** entre la
    cuenta y el elemento DEUDA/CREDITO (el impacto sobre este último mueve su
    `valor_vigente` hacia cero y el invariante actualiza `valor_pendiente`).
  - `CondonarDeuda` / `DeclararIncobrable` llevan `valor_vigente` y
    `valor_pendiente` a 0 y generan un impacto `origen_tipo` `CONDONACION` /
    `DECLARACION_INCOBRABLE` (migración 003) cuyo `origen_id` apunta a la entrada
    de auditoría del comando (no hay tabla propia).
- **Para decidir**: ¿un tipo de evento `PRESTAMO` propio (G8) en vez de
  TRANSFERENCIA hacia el elemento crédito? ¿intereses como Ajuste o como evento?

#### G28 — Dinero en custodia informal (naturaleza de Deuda/Crédito)  ✅ RESUELTO (Fase 50)
- **Qué faltaba**: cuando un tercero me transfiere plata para que le compre algo,
  ese dinero "pasa por mis cuentas pero nunca fue mío". El modelo lo obliga a
  representarse como un Crédito/Deuda (para que el neto patrimonial cuadre), pero
  no había forma de distinguirlo de una deuda financiera real — quedaba mezclado
  con el hipotecario y las tarjetas. F3 de `Docs/mockup/casos-dominio-probados.html`
  (escenario de REQUISITES, "Caso de uso típico").
- **Por qué no se resolvió antes**: el DDD modela Deuda/Crédito como una sola
  especialización de Elemento Patrimonial; UX_FLOWS pedía "sugerir crear un
  Crédito/Deuda" pero sin sub-tipos.
- **Decisión (Fase 50)**: columna `elemento_patrimonial.naturaleza`
  (`FINANCIERA` | `CUSTODIA_INFORMAL`), NOT NULL para DEUDA/CREDITO
  (default `FINANCIERA`), NULL en el resto (migración 023, 2 CHECK). Es un
  **atributo del comando `RegistrarElementoPatrimonial`** cuando la categoría es
  DEUDA/CREDITO — mismo patrón que `CondonarDeuda` vs `DeclararIncobrable`: la
  distinción vive en el modelo, no en un flag de presentación. No cambia el
  patrimonio ni genera comando nuevo. El wizard de alta lo pregunta; la app
  agrupa los `CUSTODIA_INFORMAL` bajo "Encargos y custodia", aparte de las deudas
  financieras. Ver `Docs/DDD.md` §X.2, `Docs/DATABASE_DESIGN.md` §13.
- **Para decidir**: si más adelante hace falta, un tercer valor para "garantía /
  depósito en prenda" seguiría el mismo patrón (agregar al CHECK).

### Tema E · Movimientos financieros

#### G8 — CONVERSION y PRESTAMO  ✅ RESUELTO
- **CONVERSION**: **implementado en Fase 13**. `RegistrarEventoFinanciero` con
  `tipo: 'CONVERSION'`, origen y destino en monedas distintas; el destino recibe
  el equivalente vía `ConversionService`. No se corrige (se anula y se registra
  de nuevo — la tasa afecta ambos lados); sí se anula.
- **PRESTAMO**: **descartado como tipo propio** (decisión de esta sesión). Ya se
  modela con Deuda/Crédito: crear un elemento CREDITO/DEUDA y mover el saldo con
  TRANSFERENCIA (ver G17). Se mantiene el valor `PRESTAMO` en el CHECK del
  esquema por si más adelante se quiere distinguir por efectos legales.

#### G9 — CorregirEventoFinanciero: alcance del "datos corregidos" (Fase 3)  ✅ RESUELTO (Fase 38, P5)
- **Qué falta**: AS #12 dice "datos corregidos" sin enumerarlos.
- **Decisión provisional (Fase 3)**: solo se corrige el **monto**. Cambiar tipo,
  fecha o elementos afectados requiere `AnularEventoFinanciero` + registrar de
  nuevo. Además la cadena de correcciones es lineal: no se puede corregir (ni
  anular) un evento que ya tiene una corrección viva — hay que actuar sobre la
  última corrección.
- **Para decidir**: ¿permitir corregir fecha?, ¿re-corregir encadenando deltas?

#### G10 — AnularEventoFinanciero: impactos y autorización (Fase 3)  ✅ RESUELTO
- El **colapso visual** original+corrección se hizo en Fase 29 (§A9): el detalle
  del elemento muestra una sola fila con el monto final y el rótulo "corregido".
  El resto ya estaba decidido.
- **Qué falta**: DATABASE_DESIGN §4 dice que Anular "borra o marca" los
  `impacto_patrimonial`; el esquema no tiene flag en esa tabla. El DDD no dice
  quién puede anular/corregir.
- **Decisión provisional (Fase 3)**:
  - Se **conservan** las filas `impacto_patrimonial` (no hay flag para marcar);
    quedan "marcadas" transitivamente por `evento_financiero.anulado` y se
    filtran en `GET /elementos-patrimoniales/:id/impactos`. `valor_vigente` se
    revierte con aritmética directa. El evento anulado sigue apareciendo en
    `GET /eventos-financieros?elemento=` con `anulado: true`.
  - Puede anular/corregir cualquier **propietario de un elemento afectado**.
- **Colapso visual** original+corrección (UX_FLOWS Flujo 6): la app los muestra
  como filas separadas etiquetadas; el colapso en una sola línea llega después.

#### G22 — Glosa / detalle en el movimiento financiero  ✅ RESUELTO (Fase 15c, opción a; editar glosa vía Corregir, Fase 38/P5)
- **Qué falta**: `evento_financiero` solo tiene `tipo, monto, moneda, fecha`. No
  hay dónde escribir "pago internet marzo". Ni los 6 docs lo contemplan
  (AS #5 menciona "comentarios" como tipo de información de visibilidad, pero no
  se modeló). Sin esto, el historial de movimientos es ilegible.
- **Opciones**:
  - (a) `evento_financiero.glosa TEXT NULL` — texto libre corto (≤140), opcional.
    Inmutable como el resto del evento (se corrige anulando + registrando, o se
    permite editar solo la glosa por ser texto no económico).
  - (b) tabla `comentario` polimórfica (evento / elemento / …) — más potente,
    alinea con AS #5, pero es un agregado nuevo.
- **Recomendación**: (a) para empezar. Migración 009. `RegistrarEventoFinanciero`
  y `CorregirEventoFinanciero` aceptan `glosa?`. Es configuración/anotación, no
  hecho económico → no participa de la reconstrucción histórica (Sección V).
- **Para decidir**: ¿la glosa se puede editar sin anular el evento?

#### G23 — Categorización de movimientos: categoría vs. etiqueta  ✅ RESUELTO (categorías 15c + jerárquicas Fase 39/P7; etiquetas 15i; agrupaciones 15j)
- Categorías (15c), etiquetas (15i), agrupaciones de elementos (15j), presupuesto
  por rubro (15d): ✅. Abierto (📋): **categorías jerárquicas** (`categoria_padre_id`,
  §B9) — hoy lista plana.
- **Qué falta**: no hay forma de clasificar un gasto/ingreso ("Mercado",
  "Servicios", "Sueldo"). El presupuesto (Agregado K) solo compara totales de
  ingreso/gasto, no por rubro. No hay registro rápido de gastos recurrentes.
- **Distinción** (pedida explícitamente por el usuario):
  | | Categoría | Etiqueta |
  |---|---|---|
  | Cardinalidad | 0..1 por movimiento | 0..N por movimiento |
  | Naturaleza | taxonomía excluyente | transversal, acumulativa |
  | Jerarquía | sí (padre/hijo, 2 niveles) | plana |
  | Presupuesto | base natural del rubro | ambiguo con solapamiento |
  | Alcance | vocabulario del hogar | personal |
  | Ejemplos | Mercado, Transporte, Salud, Vivienda, Sueldo | #reembolsable, #viaje-2026 |
- **Recomendación**: **ambas con roles distintos; la categoría es la columna
  vertebral**.
  - **Categoría** — tabla `categoria_movimiento(id, hogar_id, nombre,
    tipo_aplicable ENUM(INGRESO,GASTO,AMBOS), categoria_padre_id?, color?, icono?,
    orden, estado ENUM(ACTIVA,ARCHIVADA))`. `evento_financiero.categoria_id` NULL
    FK. Al crear el hogar se siembra un set inicial editable (~10 rubros). No se
    borra si tiene eventos → se archiva. Comandos `CrearCategoriaMovimiento`,
    `ActualizarCategoriaMovimiento`, `ArchivarCategoriaMovimiento`,
    `ReordenarCategoriasMovimiento`.
  - **Etiqueta** (Fase 15i) — tablas `etiqueta` (personal, `UNIQUE(usuario_id,
    nombre)`, color opcional) + `evento_etiqueta` (N:M, `ON DELETE CASCADE`).
    Migración 012. Anotación → historial solo en auditoría; se puede re-etiquetar
    un movimiento viejo sin anular (no participa de la Sección V). Comandos
    `CrearEtiqueta`, `ActualizarEtiqueta`, `EliminarEtiqueta` (cascada),
    `EtiquetarEvento` (reemplaza el conjunto de un movimiento propio no anulado).
    `RegistrarEventoFinanciero` acepta `etiquetaIds?`; `CorregirEventoFinanciero`
    hereda las del original. `GET /usuarios/me/etiquetas`. El DTO de evento gana
    `etiquetaIds: string[]`. **No** entra en el presupuesto (un gasto con 3
    etiquetas ¿a qué rubro imputa?).
  - **Agrupación de elementos patrimoniales** (Fase 15j; REQUISITES §D:
    "Inversiones" agrupando Fintual/APV/Fondo) — carpetas de VISUALIZACIÓN
    personales. Tablas `agrupacion_elemento` (personal, `UNIQUE(usuario_id,
    nombre)`, color/orden) + `agrupacion_miembro` (`elemento_id` **PK** → un
    elemento en a lo sumo UNA agrupación; ambas FK `ON DELETE CASCADE`).
    Migración 013. **No** afecta la consolidación, la reconstrucción ni el valor
    — solo la vista. **No** se confunde con Asignación (Agregado H, que reserva
    valor con un propósito). Comandos `CrearAgrupacion`, `ActualizarAgrupacion`,
    `EliminarAgrupacion` (los elementos quedan sin agrupar), y
    `DefinirElementosAgrupacion` (reemplaza el conjunto; un elemento que estaba
    en otra agrupación se mueve a esta). `GET /usuarios/me/agrupaciones`. En la
    app agrupa la lista de "Elementos" del Inicio.
- **Presupuesto por categoría** — nueva tabla `presupuesto_linea(presupuesto_id,
  categoria_id, monto_esperado)`; `desviacion_presupuestaria` se calcula también
  por rubro. Extiende G15 (que dejó "asignaciones esperadas" fuera).
- **Todo esto es configuración**, no hecho económico → historial solo en
  auditoría (DATABASE_DESIGN §125, Principio C).
- **Decisiones (sesión 2026-09-03)**:
  - Categorías **del hogar** (`categoria_movimiento.hogar_id`, vocabulario
    compartido). Administra cualquier miembro ACTIVA.
  - **Lista plana** al inicio (sin `categoria_padre_id`; se puede agregar después
    sin romper datos).
  - Categoría **siempre opcional** en el evento; los sin-categoría se agrupan como
    "Sin clasificar" en reportes.
  - **Ambas** (categoría + etiqueta), pero etiquetas y agrupaciones de elementos
    quedan para fase posterior — la categoría es la única de Fase 15c.

#### G24 — Plantillas / movimientos recurrentes rápidos (Fase 15h)  ✅ RESUELTO
- **Qué falta**: registrar "el gasto de siempre" (internet, arriendo) en 2 toques.
  Distinto de **Movimiento Programado** (#13–#16, que es un movimiento futuro
  concreto con fecha): una plantilla es un molde reutilizable sin fecha.
- **Decisión (sesión 2026-09-03)**:
  - Tabla `plantilla_movimiento(id, usuario_id, nombre, tipo INGRESO/GASTO/
    TRANSFERENCIA, monto?, moneda?, elemento_origen_id?, elemento_destino_id?,
    categoria_id?, glosa?, orden)`. Migración 011. **Personal** (`usuario_id`),
    `UNIQUE (usuario_id, nombre)`. Todos los campos salvo `nombre`/`tipo` son
    opcionales — es un molde, los huecos se llenan al usarla.
  - Es configuración → historial solo en `auditoria`; los eventos generados a
    partir de ella son independientes.
  - Comandos `CrearPlantillaMovimiento`, `ActualizarPlantillaMovimiento` (`null`
    limpia un campo), `EliminarPlantillaMovimiento` (borrado físico).
    `GET /usuarios/me/plantillas-movimiento`.
  - Validación: propiedad de los elementos; la categoría debe ser de un hogar del
    actor y compatible con el tipo; TRANSFERENCIA no lleva categoría.
  - **Usar una plantilla NO es un comando**: el cliente rellena
    `RegistrarEventoFinanciero` con sus valores. En la app: selector "Desde una
    plantilla" arriba de "Registrar movimiento" + botón "Guardar como plantilla"
    en el detalle de un movimiento (deriva origen/destino de los impactos).
  - CONVERSION queda fuera (dos monedas, más lógica).

### Tema F · Planificación: objetivos, reservas, presupuestos y programados

#### G2 — Visibilidad / propiedad de Movimiento Programado  ✅ DECISIÓN CERRADA (`tipo` Fase 33; visibilidad heredada del elemento, P12/Fase 44)
- `tipo` (INGRESO/GASTO/TRANSFERENCIA) **RESUELTO en Fase 33**. Lo que queda:
  las reglas de visibilidad/propiedad propias (hoy heredadas de los elementos)
  — decisión que DDD §S dejó abierta, se revisaría junto con §B1.
- **Qué falta**: definir si `movimiento_programado` lleva columnas de
  visibilidad/propiedad propias o hereda las del elemento destino.
- **Por qué no está resuelto**: DDD Sección S lo deja explícitamente para después
  ("Revisar si Movimiento Programado requiere reglas de visibilidad/propiedad
  propias o hereda las del Elemento Patrimonial destino").
- **Decisión provisional (Fase 7, técnica no de dominio)**: **hereda del elemento
  destino** — el actor debe ser propietario de `elemento_destino_id` para crear,
  actualizar, materializar, cancelar o ver el movimiento programado. No se agregan
  columnas al esquema. Es la lectura menos invasiva de las dos que plantea el DDD.
- **Otras simplificaciones de Fase 7**:
  - El esquema modela `elemento_destino_id` **singular** (AS #13 dice "elemento(s)
    destino"). Se usa singular.
  - ~~No hay columna `tipo`~~ → **RESUELTO Fase 33** (§B5). Migración 015 agregó
    `tipo` (INGRESO/GASTO/TRANSFERENCIA) + `elemento_origen_id`. Materializar
    genera un evento del mismo tipo (GASTO ← origen; TRANSFERENCIA origen→destino).
    Sigue escribiendo **una sola** entrada de auditoría bajo
    `MaterializarMovimientoProgramado`.
  - Materializar exige `fecha_programada <= hoy` y estado PENDIENTE. Escribe **una
    sola** entrada de auditoría (`comando = MaterializarMovimientoProgramado`,
    entidad = MOVIMIENTO_PROGRAMADO, relacionada = EVENTO_FINANCIERO).
- **Visibilidad/propiedad propias**: sigue heredada — ahora el actor debe ser
  propietario de **cada** elemento referido (origen y/o destino). Sin columnas
  propias (DDD §S). Esto puede revisarse junto con §B1 (visibilidad granular).

#### G13 — Propiedad de Objetivo Financiero y Asignación (migración 001)  ✅ RESUELTO (Fase 43, P9 — personal + compartido por hogar)
- **Qué falta**: DDD Secciones H y J no definen quién es dueño de un objetivo o
  una asignación, y el esquema original no tenía columna de propiedad.
- **Decisión**: son **personales** — la migración `api/db/migrations/001_...sql`
  agrega `usuario_id` a `objetivo_financiero` y `asignacion`. Consistente con el
  planteamiento monousuario del Flujo 5 (UX_FLOWS). Reflejado también en
  `init/01_schema.sql`.
- **Para decidir**: ¿objetivos/asignaciones compartidos por hogar?

#### G14 — Fase 5c: políticas y simplificaciones  ✅ RESUELTO (des-consumir al anular ✅ Fase 36; consumo parcial ✅ 2026-09-29)
- ✅ (Fase 36, P2) **AnularEventoFinanciero ahora "des-consume" reservas** — lee
  la lista `reservas_consumidas` de la auditoría de `RegistrarEventoFinanciero` y
  las que siguen CONSUMIDA vuelven a ACTIVA; recalcula el progreso del objetivo.
  `evento.service.#reactivarReservasConsumidas`.
- ✅ (2026-09-29) **Consumo parcial**: el evento consume reservas ACTIVAS de la
  asignación **solo hasta su monto**. Orden: primero las que están sobre un
  elemento que el evento mueve, luego las más antiguas; solo las de la misma
  moneda que el evento. **Decisión: dividir** (no columna `monto_consumido`) — si
  una reserva queda a medias, la fila original baja al monto consumido y pasa a
  CONSUMIDA, y el resto queda en una reserva ACTIVA nueva. Sin migración, los
  estados siguen binarios y `AnularEventoFinanciero` no cambia (reactiva los ids
  consumidos; el total reservado vuelve a ser el mismo, en dos filas). La
  auditoría guarda `reservas_consumidas: [{ id, monto, resto_id? }]`.
  `evento.service.#consumirReservas`; tests en `flujo5-objetivo-reserva` y
  `gaps-p1-p4`.
- **"Completar objetivo"**: solo transiciona EN_PROGRESO → COMPLETADO. Si el
  progreso baja después (LiberarReserva), el objetivo **no** vuelve a
  EN_PROGRESO solo — el usuario lo hace con `CambiarEstadoObjetivoFinanciero`
  (Principio 4: última palabra del usuario). Genera fila de auditoría propia
  encadenada al comando que la disparó (DATABASE_DESIGN §11).
- **"Consumir reserva"**: al asociar un evento financiero a una asignación
  (`asignacionId` en RegistrarEventoFinanciero), sus reservas ACTIVAS pasan a
  CONSUMIDA hasta cubrir el monto del evento (ver arriba; antes era "todas de
  golpe").
  Se registra embebido en la entrada de RegistrarEventoFinanciero.
- **Disponibilidad / valor libre**: `valor_vigente − Σ reservas ACTIVAS`,
  calculado en vivo. La reserva no mueve `valor_vigente` (no es hecho económico).
- **AnularEventoFinanciero** de un evento que consumió reservas: las
  "des-consume" (vuelven a ACTIVA) — ✅ Fase 36, ver arriba.

#### G15 — Propiedad de Presupuesto (migración 002) y "asignaciones esperadas"  ✅ RESUELTO (propiedad: migración 002; ahorro por objetivo: Fase 41, P6)
- Propiedad: ✅ (migración 002). "Asignaciones esperadas" / línea de ahorro por
  objetivo: 📋 DECISIÓN (§B7) — el presupuesto por rubro de gasto ya existe (G26).
- **Qué falta**: el esquema de `presupuesto` no tiene columna de propiedad, pero
  AS #49 audita "usuario/hogar" y `tipo` INDIVIDUAL/FAMILIAR implica dueños
  distintos. Además el input de AS #49 menciona "asignaciones esperadas" y el
  esquema no tiene esa columna (solo `ingresos_esperados`, `gastos_esperados`,
  `ahorro_esperado`).
- **Decisión (propiedad)**: migración `002_presupuesto_propietario.sql` agrega
  `usuario_id` (creador, siempre) y `hogar_id` (solo FAMILIAR), con CHECK
  `FAMILIAR ⇒ hogar_id NOT NULL` / `INDIVIDUAL ⇒ hogar_id NULL`. Misma línea que
  la 001. INDIVIDUAL → solo el dueño; FAMILIAR → cualquier miembro ACTIVA del hogar.
- **Decisión ("asignaciones esperadas")**: se **omite** — no hay columna y no se
  inventa una (BUILD_INSTRUCTIONS §4). El presupuesto cubre ingresos/gastos/ahorro.
- **Para decidir**: ¿agregar `asignaciones_esperadas` (monto agregado) o una tabla
  hija presupuesto_linea por asignación esperada?

#### G16 — Proyección desviacion_presupuestaria: alcance y moneda (Fase 6)  ✅ RESUELTO (Fase 45 — moneda como etiqueta, sin conversión, P11)
- Decisiones de alcance/agregación tomadas en Fase 6. Abierto: presupuesto con
  moneda propia (§B8) y "ahorro real" desde reservas en vez de ingresos−gastos.
- **Qué falta**: DATABASE_DESIGN §12 define la proyección como "comparación entre
  montos esperados y reales agregados desde `evento_financiero` en el período"
  sin precisar qué eventos entran ni cómo se maneja la moneda.
- **Decisión provisional (Fase 6)**:
  - **Período**: `[fecha_inicio, fecha_fin]` del presupuesto (para PERIODICO se
    derivan del intervalo; para ESPECIFICO son las declaradas — si faltan, sin
    filtro temporal).
  - **Alcance**: eventos con impacto sobre un elemento de un propietario dentro
    del alcance — el dueño (INDIVIDUAL) o los miembros ACTIVA del hogar (FAMILIAR).
  - **Agregación**: `real.ingresos = Σ monto` de eventos INGRESO;
    `real.gastos = Σ monto` de eventos GASTO; `real.ahorro = ingresos − gastos`.
    TRANSFERENCIA/CONVERSION/PRESTAMO no cuentan. Eventos anulados se excluyen.
  - **Moneda**: se suman los montos tal cual, sin tipo de cambio (ver G7). El
    presupuesto no tiene moneda propia.
- **Para decidir**: ¿presupuesto con moneda?, ¿ahorro real desde reservas/objetivos
  en vez de ingresos−gastos?, ¿excluir transferencias entre elementos del alcance
  ya está bien así?

#### G26 — Presupuesto por rubro (línea de presupuesto) (Fase 15d)  ✅ RESUELTO (Fase 15d; línea de ahorro por objetivo, Fase 41/P6)
- Líneas por categoría de gasto: ✅. Abierto (📋): ¿la suma de líneas debe cuadrar
  con `gastos_esperados`? ¿líneas de ahorro por objetivo (cierra G15)?
- **Qué falta**: el Presupuesto (Agregado K) solo compara totales de
  ingreso/gasto/ahorro (`ingresos_esperados`, `gastos_esperados`,
  `ahorro_esperado`). No hay forma de fijar cuánto se espera por categoría
  (Mercado, Servicios…), que era el punto abierto de G15 ("asignaciones
  esperadas") y lo pedido en `UI_UX_BACKLOG.md` C3. Ningún doc lo modela.
- **Decisión (sesión 2026-09-03)**:
  - Tabla `presupuesto_linea(id, presupuesto_id, categoria_id, monto_esperado ≥ 0)`
    con `UNIQUE (presupuesto_id, categoria_id)` y `ON DELETE CASCADE` desde
    `presupuesto`. Migración 010. Es **configuración**, no hecho económico → su
    historial vive solo en `auditoria` (DATABASE_DESIGN §125, Principio C); no
    participa de la reconstrucción histórica (Sección V).
  - Comando **`DefinirLineasPresupuesto`** (`{ presupuestoId, lineas: [{ categoriaId,
    montoEsperado }] }`): **reemplaza el conjunto completo** de líneas — una sola
    entrada de auditoría con `valor_anterior` / `valor_posterior`. Un rubro con
    monto 0 se elimina. Se rechaza si el presupuesto está `CERRADO`.
  - **Categorías permitidas**: FAMILIAR → las del hogar del presupuesto;
    INDIVIDUAL (sin `hogar_id`) → las de cualquier hogar donde el actor sea
    miembro ACTIVA (en el caso normal de un hogar por usuario, es inequívoco).
    Solo categorías `ACTIVA`.
  - La proyección `desviacion_presupuestaria` gana `porRubro[]` (esperado vs. real
    de cada categoría dentro del período, más los rubros con movimiento real pero
    sin línea, con esperado 0) y `sinClasificar` (ingreso/gasto real del período
    sin `categoria_id`). El "real" de un rubro usa los eventos INGRESO/GASTO del
    mismo alcance y período que el total (G16), sin tipo de cambio.
  - `GET /presupuestos/:id/lineas` para el editor (líneas + nombre/color de la
    categoría).
- **Para decidir**: ¿la suma de las líneas de gasto debería cuadrar con
  `gastos_esperados` (hoy son independientes)? ¿líneas de ahorro por objetivo
  (cierra del todo G15)?

### Tema G · Monedas, proyecciones y reportes

#### G21 — Conversión monetaria (Fase 13 + 14c)  ✅ RESUELTO (conversión + triangulación ✅; importación desde mindicador.cl ✅ 2026-09-29)
- `ConversionService` (Fase 13): tasa directa más reciente con
  `fecha_vigencia <= fecha`; si no hay, el inverso B→A (`1/tasa`).
- **Triangulación (Fase 14c)**: si tampoco hay inverso, se busca una moneda
  pivote C con A↔C y C↔B disponibles (máx. 2 saltos). Con varias pivotes se
  elige la primera alfabéticamente — determinista. Si no hay ninguna, la
  conversión falla (y el total consolidado queda `null`).
- `RegistrarTipoCambio` (comando nº 53) es dato global, inmutable; para
  "corregir" una tasa se registra otra con fecha de vigencia posterior.
- ✅ (2026-09-29) **Importación automática** desde mindicador.cl (gratis, sin
  API key): `ImportacionTasasService` inserta USD→CLP, EUR→CLP y CLF→CLP (UF)
  con la fecha calendario de Chile y `fuente = 'mindicador.cl'`. Corre **al
  arrancar y cada hora** (`@nestjs/schedule`) — Render free duerme el servicio,
  así que no se confía en una hora fija. Idempotente por la UNIQUE
  (origen, destino, fecha): no pisa una tasa cargada a mano. Sin auditoría (no
  hay usuario actor; la fila queda trazada por `fuente`). Solo corre con
  `TIPOS_CAMBIO_IMPORTACION=true` (en `render.yaml`). Tests:
  `src/tipo-cambio/importacion-tasas.service.spec.ts`.

#### G7 — Proyecciones: en vivo vs. materializada  ✅ DECISIÓN CERRADA (P13: todas en vivo; revisar solo si aparece un problema de performance)
- **Qué falta**: DATABASE_DESIGN §12 y el comentario de `schema.sql` dejan
  pendiente si las proyecciones son vista SQL en vivo o tabla materializada
  (decisión de performance).
- **Decisión provisional**: **todas en vivo** desde la info primaria
  (Principio 1) — `patrimonio_individual`, `patrimonio_familiar_consolidado`,
  `progreso_objetivo`, `desviacion_presupuestaria`, métricas del hogar,
  reconstrucción histórica.
- **Resuelto en Fase 13**: el total consolidado entre monedas ya existe —
  `GET /hogares/:id/patrimonio-consolidado` devuelve `total` en la moneda del
  hogar usando `tipo_cambio` (migración 007), y `null` + `conversionesFaltantes`
  si falta alguna tasa. `patrimonio-individual` sigue siendo solo `porMoneda`
  (el usuario no tiene "moneda de consolidación" propia).
- **Para decidir**: materializar si el cálculo en vivo escala mal.

#### G27 — Reportes financieros por período (Fase 16)  ✅ RESUELTO (Fase 16)
- **Qué falta**: no había forma de ver "mis gastos de marzo" ni "el año 2026". El
  desglose por rubro solo vivía dentro del detalle de un presupuesto; la lista de
  movimientos solo se veía por elemento o en `GET /hogares/:id/eventos-financieros`
  (sin filtro de fecha ni categoría).
- **Decisión (sesión 2026-09-03)**: **proyección de lectura**, no dominio. No
  inventa reglas ni comandos — agrega los `evento_financiero` que ya existen.
  Módulo `src/reporte/` (no @Global).
  - `GET /usuarios/me/resumen-financiero?desde=&hasta=&alcance=mios|hogar&hogarId=`
    → `{ periodo, alcance, porMoneda: [{moneda, ingresos, gastos, balance}],
    porRubro: [{categoriaId|null, nombre, color, tipo, total}], movimientos: [...] }`.
  - `GET /usuarios/me/resumen-anual?anio=&alcance=&hogarId=` → 12 baldes
    `{mes, porMoneda}`.
  - **Alcance**: `mios` = eventos que impactan mis elementos; `hogar` = los de
    todos los miembros ACTIVA (exige ser miembro).
  - **Correcciones**: se colapsan igual que `eventosDelHogar` — `monto` es el neto
    tras las correcciones vivas (`monto` del raíz + Σ deltas).
  - **Sin conversión de moneda** (G7/G16): `porRubro.total` suma montos crudos;
    `porMoneda` da el desglose exacto. `porMoneda`/`porRubro` solo INGRESO/GASTO.
    Eventos anulados fuera.
  - **Transferencias visibles (Fase 50)**: `movimientos` incluye
    TRANSFERENCIA/CONVERSION como filas neutras (`efectoPropio` = impacto sobre
    las cuentas propias del alcance) — **no** suman a `porMoneda` ni a `porRubro`.
    Antes se filtraban por completo y el patrimonio "bajaba sin explicación"
    (F1 de `Docs/mockup/casos-dominio-probados.html`).
- **Para decidir**: ¿comparación automática con el período anterior en el
  endpoint, o la calcula el cliente con dos llamadas? (hoy: el cliente).
