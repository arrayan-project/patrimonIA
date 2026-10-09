# UX / Flujos de Usuario — PatrimonIA

**Objetivo:** cómo se ve y se navega cada flujo, pantalla por pantalla, sobre
el modelo ya cerrado en `DDD.md`/`APPLICATION_SERVICES.md`/`API_DESIGN.md`.
La Parte 3 es el estado vigente de la app (navegación, pantallas actuales) —
es lo primero a mirar si algo en `UI_UX_BACKLOG.md` (retirado) parece contradecirlo.

> **Migrado de `.docx` a Markdown el 2026-09-06** (el original está en `Docs/_baseline/`). Este `.md` es ahora la fuente de verdad; las decisiones posteriores a Fase 0 se integran aquí y se registran en `GAPS.md`.

*Documento de diseño de flujos, construido sobre el modelo ya cerrado (DDD, Application Services, API Design). No introduce reglas de negocio nuevas: cada paso de cada flujo se mapea a un comando o consulta ya definido en API_DESIGN.md. Donde un flujo requiere una decisión de interacción no cubierta por el dominio (ej. cómo se presenta un error de validación), se marca explícitamente como decisión de UX, no de dominio.*

## Estructura de este documento

- Parte 1 — Flujos end-to-end: seis flujos representativos, cada uno cruzando los agregados relevantes, con cada paso mapeado a su comando/consulta de API.
- Parte 2 — Desglose de pantallas: de los seis, los que tienen mayor complejidad de interacción se bajan a nivel pantalla → acción → pantalla siguiente.

# PARTE 1 — FLUJOS END-TO-END

## Flujo 1 — Día a día financiero (caso de uso típico, REQUISITES)

*Basado directamente en el “Caso de uso típico” de REQUISITES.md — sueldo, gastos, ahorro provisional, transferencias entre miembros del hogar.*

| Paso | Acción del usuario | Comando/Consulta API | Efecto en el dominio |
| --- | --- | --- | --- |
| 1 | Recibe sueldo en cuenta corriente | `POST /comandos/RegistrarEventoFinanciero` (tipo INGRESO) | Impacto patrimonial +monto sobre elemento “Cuenta Corriente”. Recalcula patrimonio (W). |
| 2 | Transfiere parte a su cuenta RUT | `POST /comandos/RegistrarEventoFinanciero` (tipo TRANSFERENCIA) | 2 impactos: salida en Cuenta Corriente, entrada en Cuenta RUT. |
| 3 | Paga el mercado desde cuenta RUT | `POST /comandos/RegistrarEventoFinanciero` (tipo GASTO) | Impacto -monto sobre Cuenta RUT. |
| 4 | Transfiere a su esposa para que pague Netflix | `POST /comandos/RegistrarEventoFinanciero` (tipo TRANSFERENCIA, elemento destino = elemento de la esposa) | Impacto de salida en su cuenta; el impacto de entrada queda en un elemento patrimonial cuyo propietario es la esposa — requiere que ambos elementos existan y sean visibles entre sí (Sección M, REQUISITES). |
| 5 | Aparta dinero para “mantención auto” (ahorro provisional) | `POST /comandos/RegistrarEventoFinanciero` (tipo TRANSFERENCIA, hacia elemento Fintual) seguido de `POST /comandos/CrearAsignacion` + `POST /comandos/CrearReserva` | El movimiento del dinero es un evento financiero real; la reserva es lógica pura sobre el elemento Fintual — no mueve dinero de nuevo (Sección E/F, REQUISITES). |
| 6 | Pagó el mercado de sus papás, ellos devuelven en 3 días | `POST /comandos/RegistrarEventoFinanciero` (tipo GASTO) ahora; luego, al recibir la devolución, `POST /comandos/RegistrarEventoFinanciero` (tipo INGRESO) | Son dos eventos financieros independientes, no un único movimiento con estado “pendiente de cobro” — el dominio no modela cuentas por cobrar informales, solo Crédito como elemento patrimonial formal (Sección J, REQUISITES). *Nota de UX: si el usuario espera trackear esto como “deuda de un tercero”, la app debería sugerir crear un Elemento Patrimonial tipo Crédito en vez de solo un gasto — ver Flujo 4.* |
| 7 | Fin de mes: junta saldos de ambas cuentas y transfiere a Fintual para el objetivo Casa | `POST /comandos/RegistrarEventoFinanciero` (dos transferencias) + `POST /comandos/CrearReserva` o `AjustarMontoReserva` sobre la asignación “Casa” | Cada transferencia es un evento independiente; la reserva se ajusta después, no automáticamente — el usuario decide explícitamente cuánto de lo transferido reserva para el objetivo. |

Decisión de UX marcada en el paso 6: el modelo de dominio no tiene un concepto de “gasto con expectativa de reembolso”. Esto no es un vacío del DDD — es una decisión consciente (Sección J, REQUISITES: Crédito es un elemento patrimonial formal, no una anotación sobre un gasto). La UX debe guiar al usuario hacia el flujo correcto (Flujo 4) en vez de dejarlo registrar el reembolso como un ingreso genérico sin trazabilidad.

## Flujo 2 — Alta de hogar e incorporación de miembro

*No aparece en el caso de uso típico de REQUISITES, pero es el flujo de entrada obligatorio: todo usuario debe pertenecer a un hogar para usar la plataforma (Sección B, REQUISITES).*

| Paso | Acción del usuario | Comando/Consulta API | Efecto en el dominio |
| --- | --- | --- | --- |
| 1 | Se registra en la plataforma | `POST /comandos/RegistrarUsuario` | Usuario creado, momentáneamente sin hogar (Sección B, DDD). |
| 2 | Elige: crear hogar nuevo o unirse a uno existente | — (decisión de UX, no comando) | Bifurcación de flujo. |
| 2a | Crea un hogar nuevo | `POST /comandos/CrearHogar` | Usuario se vuelve Administrador automáticamente. |
| 2b | Espera invitación de un hogar existente | (ninguno — pasivo) | — |
| 3 | El administrador del hogar invita a un nuevo miembro | `POST /comandos/InvitarMiembro` | Invitación queda PENDIENTE. |
| 4 | El invitado ve la invitación pendiente | `GET /hogares/{id}/invitaciones?estado=PENDIENTE` (o notificación push, fuera de alcance del dominio) | — |
| 5 | El invitado acepta | `POST /comandos/AceptarInvitacion` | Dispara política interna UnirseAHogar — crea membresía, rol Miembro estándar. |
| 6 | (alternativa) El invitado rechaza | `POST /comandos/RechazarInvitacion` | Invitación cerrada, sin membresía. |

Decisión de UX: el paso 2 (crear vs. unirse) es la primera pantalla real que ve un usuario nuevo — candidato natural para desglose de pantallas en Parte 2, porque es el único punto de entrada de todo el sistema y determina el resto de la experiencia inicial.

## Flujo 3 — Registro y valorización de un activo no líquido (inmueble)

*Cubre Valorización (Sección G, DDD), que el caso de uso típico de REQUISITES no toca — todos sus ejemplos son liquidez, no activos valorizables.*

| Paso | Acción del usuario | Comando/Consulta API | Efecto en el dominio |
| --- | --- | --- | --- |
| 1 | Registra un inmueble como elemento patrimonial | `POST /comandos/RegistrarElementoPatrimonial` (categoría funcional = ACTIVO, `admite_valorizacion = true`) | Elemento creado con valor inicial = precio de compra. |
| 2 | Un año después, el valor de mercado subió | `POST /comandos/RegistrarValorizacion` (valor nuevo) | Valor vigente del elemento se reemplaza (no se suma) · impacto patrimonial generado · recalcula patrimonio (W). |
| 3 | Consulta el historial de valorizaciones | `GET /elementos-patrimoniales/{id}/valorizaciones` | Lista ordenada por fecha — incluye la valorización inicial implícita (valor de compra) y todas las posteriores. |
| 4 | Se equivocó al ingresar el valor nuevo | `POST /comandos/CorregirValorizacion` (valor correcto, motivo) | Genera valorización compensatoria enlazada a la original — la original nunca se borra (Sección T, patrón de corrección). |

Nota de UX: el paso 4 es donde más se nota la diferencia entre “editar” (lo que un usuario esperaría de una app simple) y “corregir” (lo que el dominio realmente hace — generar una entrada compensatoria). La UX tiene que comunicar esto sin exponer el detalle técnico: probablemente un botón “Corregir” que visualmente colapsa el par original+corrección en una sola fila (tal como el propio DDD lo sugiere en la Sección T: “permite colapsar visualmente el par en vistas consolidadas”).

## Flujo 4 — Deuda compartida: registro y pago

*Cubre Deuda/Crédito (Sección J, REQUISITES) y propiedad compartida con % (decisión de esta sesión) — ninguno de los dos aparece en el caso de uso típico.*

| Paso | Acción del usuario | Comando/Consulta API | Efecto en el dominio |
| --- | --- | --- | --- |
| 1 | Le prestan plata a un amigo, en conjunto con su pareja | `POST /comandos/RegistrarElementoPatrimonial` (categoría funcional = CREDITO, propietarios = [usuario, pareja], porcentaje declarado manualmente — ej. 50/50) | Elemento tipo Crédito creado, `valor_pendiente` = monto prestado. |
| 2 | El amigo paga una parte | `POST /comandos/RegistrarEventoFinanciero` (tipo INGRESO, o un tipo específico “pago de deuda” si se decide extender el catálogo — hoy usa RegistrarEventoFinanciero genérico) | Impacto patrimonial reduce `valor_pendiente` · política “Derivar estado operativo” recalcula estado (activa → parcialmente pagada, no es un estado formal en el esquema actual, ver nota). |
| 3 | El amigo no puede pagar el resto, se declara incobrable | `POST /comandos/DeclararIncobrable` (motivo) | Impacto patrimonial lleva `valor_pendiente` a cero · elemento se conserva para efectos históricos (Sección T, DDD). |
| 4 | Consulta cuánto le corresponde a cada propietario del crédito original | `GET /elementos-patrimoniales/{id}` | Devuelve el elemento con el desglose de propiedad — el % de cada uno aplica sobre el valor pendiente restante en cada momento, no solo al final. |

Nota de diseño detectada en este flujo (no resuelta, para tu decisión): el DATABASE_DESIGN.md no define un estado operativo explícito con valores intermedios (ej. “parcialmente pagada”) — la Sección T del DDD dice que el estado operativo “se deriva automáticamente del valor pendiente, como política, no como comando”, pero no especifica los valores posibles de ese estado derivado más allá de que llega a cero. Esto es un vacío pequeño mío que no había visto en los bloques anteriores: la UX necesita mostrar algo entre “activa” y “pagada completamente”, y ese “algo” no está nombrado en ningún documento. No lo resuelvo yo aquí — lo marco para que decidas si es un valor calculado trivial (ej. simplemente mostrar el % pagado) o si necesita nombrarse como estado formal.

## Flujo 5 — Objetivo financiero con asignación y reserva, hasta completarse

*Cubre Objetivo Financiero + Asignación + Reserva + la política automática “Completar objetivo” (Principio 4, DDD) — la pieza de inferencia automática con control humano que el DDD trata como principio transversal.*

| Paso | Acción del usuario | Comando/Consulta API | Efecto en el dominio |
| --- | --- | --- | --- |
| 1 | Crea el objetivo “Pie vivienda”, monto objetivo $10.000.000 | `POST /comandos/CrearObjetivoFinanciero` | Estado inicial = En progreso, progreso = 0. |
| 2 | Crea una asignación asociada al objetivo | `POST /comandos/CrearAsignacion` (objetivo asociado = Pie vivienda) | Asignación creada, sin reservas aún. |
| 3 | Reserva $2.000.000 desde su cuenta Fintual | `POST /comandos/CrearReserva` | Descuenta del valor libre de Fintual · recalcula progreso del objetivo (ahora 20%). |
| 4 | Sigue reservando en meses sucesivos | `POST /comandos/AjustarMontoReserva` o nuevas `CrearReserva` | Progreso sube cada vez (W). |
| 5 | Alcanza el monto objetivo | (ningún comando del usuario) | Política automática “Completar objetivo” se dispara sola: cambia estado a Completado, notifica al usuario (Principio 4). |
| 6 | El usuario decide reabrir el objetivo (ej. quiere ahorrar más) | `POST /comandos/CambiarEstadoObjetivoFinanciero` (nuevo estado = En progreso) | Transición manual — el sistema nunca le impide esto, es su última palabra (Principio 4). |

Nota de UX: el paso 5 es el único de los seis flujos donde el sistema actúa sin que el usuario haga clic en nada — la notificación de “objetivo completado” tiene que ser visible pero no bloqueante, y el paso 6 (reabrir) tiene que estar accesible desde esa misma notificación para que el “control humano” del Principio 4 sea real y no solo teórico.

## Flujo 6 — Corrección de un evento financiero mal registrado

*El patrón de corrección es, según tus propias palabras en la Sección T, uno de los pilares del diseño — merece verse en un flujo completo, no solo como nota técnica en Application Services.*

| Paso | Acción del usuario | Comando/Consulta API | Efecto en el dominio |
| --- | --- | --- | --- |
| 1 | Registra un gasto de $50.000 | `POST /comandos/RegistrarEventoFinanciero` | Impacto -$50.000 sobre el elemento. |
| 2 | Se da cuenta de que el monto real era $45.000 | — | — |
| 3 | Corrige el evento | `POST /comandos/CorregirEventoFinanciero` (datos corregidos, motivo) | Genera evento compensatorio de +$5.000 (la diferencia) enlazado al original · el evento original permanece intacto e inmutable (Sección T). |
| 4 | Consulta el historial del elemento | `GET /eventos-financieros?elemento={elemento_id}` | Ve 2 eventos: el original -$50.000 y la corrección +$5.000 — el neto es -$45.000. |
| 5 | En la vista consolidada del hogar | `GET /eventos-financieros?hogar={hogar_id}` | El par original+corrección puede colapsarse visualmente en una sola línea de $45.000 (decisión de UX, sugerida por el propio DDD, Sección T). |

Decisión de UX explícita: el paso 5 requiere que la capa de presentación sepa agrupar un evento con su(s) corrección(es) usando `correccion_de_id` — esto no es un endpoint nuevo, es lógica de agregación en el cliente o en el servicio de lectura, ya anticipada en API_DESIGN.md pero nunca antes bajada a “así se ve en pantalla”.

# PARTE 2 — DESGLOSE DE PANTALLAS

*Solo para los flujos donde la complejidad de interacción (no solo la secuencia de comandos) es alta: Flujo 2 (único punto de entrada al sistema) y Flujo 5 (única transición autónoma del sistema que el usuario debe entender). Los otros cuatro flujos son operacionalmente lineales — no requieren desglose de pantalla, sería ruido documentar wireframes de “llenar formulario, enviar”.*

## Desglose — Flujo 2: Alta de hogar

```
[Pantalla: Registro]
  Campos: email, nombre, contraseña
  Acción: RegistrarUsuario
  → [Pantalla: Bienvenida / Elegir camino]

 [Pantalla: Bienvenida / Elegir camino]
  "Todo usuario debe pertenecer a un hogar" (mensaje explicativo — REQUISITES Sección B)
  Opción A: [🏠 Crear mi hogar]
  Opción B: [✉️ Me invitaron]
  Opción C: [Esperar invitación] (estado pasivo, sin acción; desde G35 la
            pantalla no lo dice en texto: Bienvenida es ese estado)

  → Opción A: [Pantalla: Crear Hogar]
  → Opción B: [Pantalla: Ingresar código/ver invitaciones]
  → Opción C: [Pantalla: Estado "sin hogar"] (permite reintentar B en cualquier momento)

 [Pantalla: Crear Hogar]
  Campo: nombre del hogar
  Acción: CrearHogar
  Resultado automático: usuario = Administrador (sin paso adicional, mostrado como confirmación)
  → [Pantalla: Dashboard del hogar] (vacío, invita a "Agregar tu primer elemento patrimonial" o "Invitar a un miembro")

 [Pantalla: Ingresar código/ver invitaciones]
  Lista de invitaciones pendientes (GET /hogares/{id}/invitaciones?estado=PENDIENTE, filtrado por el usuario invitado)
  Cada invitación: [Aceptar] [Rechazar]
  → Aceptar: AceptarInvitacion → [Pantalla: Dashboard del hogar] (ahora con datos existentes del hogar)
  → Rechazar: RechazarInvitacion → vuelve a [Pantalla: Bienvenida / Elegir camino]

 [Pantalla: Dashboard del hogar → Invitar miembro] (solo visible si rol = Administrador)
  Campo: email del invitado
  Acción: InvitarMiembro
  → Confirmación inline, vuelve al Dashboard
```

Decisión de UX no cubierta por el dominio: qué pasa si un usuario nuevo no tiene invitación pendiente y tampoco quiere crear un hogar todavía — el DDD no prohíbe este estado transitorio (“el usuario puede existir momentáneamente sin hogar”), pero la UX necesita decidir si bloquea el resto de la app en ese estado o permite explorar en modo lectura. Esto no está definido en ningún documento y no es una decisión de dominio — es puramente de producto.

## Desglose — Flujo 5: Objetivo financiero hasta completarse

```
[Pantalla: Lista de Objetivos]
  [+ Nuevo objetivo]
  → [Pantalla: Crear Objetivo]

 [Pantalla: Crear Objetivo]
  Campos: nombre, monto objetivo, fecha objetivo (opcional)
  Acción: CrearObjetivoFinanciero
  → [Pantalla: Detalle del Objetivo] (progreso = 0%, sin asignaciones)

 [Pantalla: Detalle del Objetivo]
  Barra de progreso (GET /objetivos-financieros/{id}, proyección progreso_objetivo)
  Lista de asignaciones asociadas (vacía al inicio)
  [+ Asociar asignación existente] o [+ Crear asignación para este objetivo]
  → CrearAsignacion (objetivo_asociado = este) → vuelve a Detalle, ahora con la asignación listada

 [Pantalla: Detalle del Objetivo → tap en una asignación]
  Lista de reservas de esa asignación (GET /asignaciones/{id}/reservas)
  [+ Nueva reserva]
  → [Pantalla: Crear Reserva]

 [Pantalla: Crear Reserva]
  Selector: elemento patrimonial origen
  Campo: monto (con validación de disponibilidad — feedback inline si excede valor libre)
  Acción: CrearReserva
  → Vuelve a Detalle del Objetivo, barra de progreso actualizada

 --- Transición autónoma del sistema (sin pantalla iniciada por el usuario) ---

 [Notificación: "¡Objetivo completado!"]
  Se dispara cuando progreso alcanza 100% (política "Completar objetivo", Principio 4)
  No bloqueante — aparece como notificación/banner, no como modal que interrumpe
  Acciones disponibles directo desde la notificación:
  [Ver objetivo] → Detalle del Objetivo (ahora estado = Completado)
  [Reabrir] → CambiarEstadoObjetivoFinanciero (nuevo estado = En progreso) — un solo tap, sin fricción,
  porque el Principio 4 exige que el usuario tenga "siempre la última palabra"

 [Pantalla: Detalle del Objetivo — estado Completado]
  Mismo layout que en progreso, pero con indicador visual de completado
  El botón [Reabrir] permanece visible y accesible — no se esconde en un menú secundario,
  porque el DDD trata esto como decisión frecuente y legítima, no una acción excepcional
```

Decisión de UX explícita, justificada por el dominio: el botón “Reabrir” no puede estar escondido ni requerir confirmación con fricción alta (ej. “¿estás seguro?” con modal) — porque el Principio 4 del DDD es explícito en que el usuario “conserva siempre la capacidad de editar o revertir manualmente ese cambio ante una decisión repentina”. Un diseño que dificulte revertir estaría violando un principio transversal del dominio, no solo tomando una decisión de estilo.

# Resumen y vacíos detectados en este bloque

Este documento no introdujo reglas de negocio nuevas — cada paso de cada flujo se apoya en un comando o consulta ya definido en API_DESIGN.md. Sin embargo, construir los flujos end-to-end expuso 2 puntos que no estaban visibles al nivel de abstracción de los documentos anteriores:

1. ~~Estado operativo intermedio de Deuda/Crédito no nombrado~~ → **resuelto (GAPS G1)**: 6 estados derivados — `VIGENTE`, `PARCIALMENTE_PAGADA`, `EN_MORA`, `SALDADA`, `CONDONADA`, `INCOBRABLE` — calculados, no persistidos. Ver `DDD.md` §X.2.
2. ~~Ausencia de concepto "gasto con expectativa de reembolso informal"~~ → **resuelto en dos capas (GAPS G28/G30)**: (a) el dominio distingue `naturaleza = CUSTODIA_INFORMAL` en el elemento Deuda/Crédito; (b) la UI **guía activamente** — al registrar un INGRESO o un GASTO, un aviso propone crear un Crédito/Deuda si el dinero es de un tercero o se va a devolver (ver Parte 3, "Registrar movimiento").

---

# PARTE 3 — Arquitectura de información y pantallas (Fases 15–52)

> El diseño de navegación evolucionó bastante desde los 6 flujos originales. Esta
> parte documenta la IA vigente. Los flujos 1–6 siguen siendo válidos como
> recorridos; cambia dónde viven las pantallas.

## Navegación principal — 4 tabs

| Tab | Rol | Contenido |
|---|---|---|
| **Inicio** | El patrimonio de un vistazo | Hero (patrimonio neto + variación), desglose KPI de composición (6 categorías funcionales), tira de disponibilidad (líquido / apartado / disponible), alertas (máx 3, por prioridad), atajos, "Primeros pasos". Engranaje → Ajustes. |
| **Movimientos** | El flujo, por período | Un selector **Mes / Año / Recientes**; debajo, juntos: KPIs del período (ingresos − gastos = balance, "Disponible hoy") + dona de gastos por rubro + la lista de movimientos de ese período. Incluye transferencias como fila neutra. |
| **Planificar** | Metas y límites | Objetivos (con avance), "Apartado" (asignaciones/reservas), presupuesto vigente. Submenú: programados (con "¿Se repite?", D-6), frecuentes, evolución. |
| **Hogar** | Lo compartido | Personas (miembros, invitaciones), "Qué se comparte", Patrimonio del hogar, **Movimientos del hogar**. |

**Ajustes** vive en una pantalla apilada (no es tab), abierta desde el engranaje
de Inicio: perfil, notificaciones, apariencia (tema), y los catálogos
(categorías, tipos de elemento, etiquetas, agrupaciones, tipos de cambio).

**Alcance Míos / Del hogar**: un único control compartido y persistido
(`patrimonia.alcance`), presente en Inicio y Movimientos; cambia el alcance de
todas las cifras a la vez.

**Paleta**: monocromática (blanco/negro puro); rojo/verde reservados para el
signo de una cifra. Sigue el tema del sistema por defecto.

## Pantallas nuevas respecto de Fase 0

| Pantalla | Para qué | Endpoints |
|---|---|---|
| Movimientos (mensual/anual) | reemplaza el "hub" — `resumen-financiero` / `resumen-anual` | Fase 16 |
| Patrimonio › sección | drill-down de una categoría funcional desde el desglose de Inicio | Fase 49 |
| Movimientos del hogar | feed consolidado, transferencia como movimiento único (REQUISITES 213) | `hogares/:id/eventos-financieros` |
| Evolución del patrimonio | `serie-patrimonial` + `variacion-patrimonial` | Fase 9/15g |
| Categorías / Tipos de elemento / Etiquetas / Agrupaciones | catálogos, con alta inline | Fase 15c–j / 40 |
| Frecuentes (plantillas de movimiento) | moldes; chips "Frecuentes" de un toque en Registrar movimiento; "Guardar como frecuente" desde el detalle de un movimiento (G33, D-6) | Fase 15h |
| Tipos de cambio | tasas registradas (alta manual) | Fase 13 |
| Ajustes / Notificaciones (preferencias) | silenciar tipos de notificación | Fase 15c/49 |
| Presupuesto › rubros | editor de `presupuesto_linea` + `linea_ahorro` | Fase 15d/41 |

## Registrar movimiento — guías activas (GAPS G30)

Al elegir el tipo, la pantalla muestra una nota contextual:

- **INGRESO** → *"¿Te van a devolver este dinero, o es de un tercero para comprarle algo? No lo registres como ingreso —se sumaría a tus ingresos del mes—. Créalo como un Crédito (te deben) o una Deuda tipo 'encargo'."* + enlace directo a "Agregar cuenta o bien" preseleccionando categoría CRÉDITO.
- **GASTO** → *"¿Alguien más puso parte? Registra primero una transferencia desde su cuenta a la tuya y luego este gasto por el total: así queda el rastro de quién aportó cuánto."*
- **CONVERSION** → nota sobre la tasa de cambio vigente.

Estas guías materializan lo que el "Flujo 1, paso 6" original solo pedía como
intención. El gasto co-financiado (varias personas aportan) se resuelve con el
patrón "transferencia primero"; no se modeló un evento con múltiples orígenes
(GAPS G30, decisión del usuario).

## Visibilidad al crear un elemento (GAPS G6 / F2)

El wizard "Agregar cuenta o bien" pregunta **explícitamente**, con dos controles
separados (solo si el usuario tiene co-miembros):

1. *"¿El hogar puede ver que esta cuenta existe?"* (EXISTENCIA — sí/no)
2. si sí → *"¿También puede ver el saldo?"* (VALOR — sí/no, independiente)

Por defecto (sin tocar nada): ambos privados — pero como **elección explícita**,
no como herencia silenciosa. Antes, todo nacía `PRIVADA` sin preguntar, lo que
impedía el paso 4 del Flujo 1 (transferir a la cuenta de otro miembro, que no
aparecía en el selector).
