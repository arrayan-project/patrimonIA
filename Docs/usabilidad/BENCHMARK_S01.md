# Benchmark de patrones: Sesión 01 (Fase C de G33)

> **Estado (2026-10-10):** historia. Sus decisiones se tomaron en la Fase D y se implementaron en la Fase E de G33 (`GAPS.md`, G33).

**Objetivo de este archivo:** dar, para cada brecha que encontró la Fase B, al
menos un patrón externo concreto y aplicable sin romper el dominio. Es la
entrada de la Fase D (rediseño y mockup).

- **Ubicación en el repo:** `Docs/usabilidad/BENCHMARK_S01.md`
- **Fecha:** 2026-09-29 · **Entradas:** `USABILIDAD_REAL_S01.md` (v3) y
  `RECORRIDO_ESCENARIOS_S01.md` (línea base `f0ae411`).
- **Alcance:** los 18 escenarios con veredicto "No" (7) o "Sí con
  conocimiento previo" (11) de la tabla resumen del recorrido (§8), con
  foco en M8/M10 + HZ-11 y en A1/A2/A5.
- **Método y límite honesto:** el benchmark se hizo sobre el conocimiento de
  cada producto a mediados de 2026, **a nivel de patrón**, no navegando las
  apps en vivo. Lo que se toma es la mecánica (qué pregunta, en qué orden,
  qué resuelve por debajo), no pantallas concretas. Si alguna referencia se
  va a citar fuera de este repo, verificar la versión actual del producto.

---

## 0. Resultado en una frase

Las 18 brechas se agrupan en **5 patrones transversales**. Ninguno exige
reescribir el dominio; tres exigen decisiones de dominio acotadas (HZ-11,
HZ-16 y D-5), y el resto se resuelve componiendo comandos que ya existen.

## 1. Referencias usadas

| Producto | Por qué es referencia | Qué se toma |
|----------|----------------------|-------------|
| **Fintual** | Metas como destino de dinero real; es la cuenta que usa el hogar | Cada meta tiene su propio lugar; depositar = elegir la meta |
| **Monzo (Pots) / Revolut (Vaults) / Nubank (Caixinhas)** | Ahorro como "mover a un bolsillo" en una sola acción | Mover hacia y desde la meta con un solo gesto; gastar desde la meta |
| **YNAB** | Presupuesto, tarjetas de crédito, reembolsos y programados | Tarjeta como cuenta; reembolso que **resta gasto** en vez de sumar ingreso; repetición como propiedad del movimiento |
| **Splitwise / Tricount** | Plata de terceros y gastos compartidos | Saldo **por persona**; "pagado por X, dividido entre…"; "saldar" |
| **Honeydue** | Finanzas de pareja | Niveles de qué se comparte por cuenta, en lenguaje cotidiano |
| **Monarch Money** | Hogar, cuentas manuales, metas y presupuesto flexible | "Actualizar saldo" en cuentas manuales; presupuesto de un solo número |

## 2. Los 5 patrones transversales

| # | Patrón | Qué dice | Referencias | Hipótesis que respalda |
|---|--------|----------|-------------|------------------------|
| **P-A** | **Intención primero** | La entrada es un verbo del usuario ("Ahorrar", "Pagar tarjeta", "Actualizar saldo", "Plata de otra persona"), no un tipo contable. La app compone los comandos por debajo. | Monzo, Revolut, YNAB, Monarch | HIP-1, HIP-4 |
| **P-B** | **Saldo por persona** | La plata de terceros se lleva como un saldo con cada persona ("Noira: le debes 30.000"), no como un elemento patrimonial que el usuario da de alta a mano. | Splitwise, Tricount | HIP-2 |
| **P-C** | **Divulgación contextual** | Lo raro aparece solo cuando el contexto lo activa (una cuenta con plata apartada, una cuenta compartida), nunca como aviso fijo. | Monzo, YNAB | §2 (lo raro no compite con lo frecuente) |
| **P-D** | **Repetición como propiedad** | "Se repite cada mes" es un campo del movimiento, no otra pantalla ni otro concepto. | YNAB, Splitwise, apps bancarias | — |
| **P-E** | **Un solo concepto con niveles** | Una pregunta con niveles ordenados reemplaza varias configuraciones independientes. El detalle fino queda en "Avanzado". | Honeydue, Monzo (Pots) | HIP-3, D-2 |

---

## 3. Brechas y patrones por escenario

Formato: brecha (de B) → patrón externo → aplicación a PatrimonIA → impacto en
el dominio (`Ninguno` / `Orquestación` / `DOMINIO`).

### 3.1 Metas y ahorro: A1, A2, A5, A4, A7

#### A1: Transfiero a Fintual, a mi meta Hogar (No)
- **Brecha:** dos operaciones en dos pestañas; la ayuda dice "no sale de la
  cuenta", lo que contradice el modelo mental.
- **Patrón:** Fintual, Monzo Pots y Nubank Caixinhas. En los tres, ahorrar es
  **una sola acción desde la meta**: "Agregar dinero" → origen → monto. En
  Fintual, además, cada meta vive en un lugar propio, así que el destino no se
  pregunta.
- **Aplicación:** la meta tiene una **cuenta de destino por defecto**
  (Fintual para "Hogar"). "Ahorrar" pide solo origen y monto. Si el origen es
  distinto del destino → TRANSFERENCIA + reserva en destino. Si es el mismo →
  solo reserva (fondo virtual, A6). El usuario nunca elige entre "apartar" y
  "transferir".
- **Dominio:** Orquestación. Confirma **D-1 (b)**: un servicio de aplicación
  con una sola transacción. La "cuenta por defecto de la meta" es un dato de
  presentación: si no se quiere persistir en el dominio, puede derivarse de la
  cuenta con más reserva hacia esa meta.

#### A2: Junto lo que sobra de dos cuentas y lo mando a la meta (No)
- **Brecha:** A1 repetido; "lo que sobra" no se ve por cuenta.
- **Patrón:** YNAB ("Assign": repartir desde varias fuentes en una pantalla)
  y el selector de origen de Monzo, que muestra el disponible de cada cuenta.
- **Aplicación:** en la misma hoja de "Ahorrar", **"+ otra cuenta"** para
  sumar orígenes, y cada origen muestra su **disponible** (no el saldo), con
  un botón "Todo lo disponible". Un solo "Confirmar".
- **Dominio:** Orquestación (la misma de D-1, con N transferencias en una
  transacción).
- **Consecuencia para la Fase D:** A1 y A2 son un solo mockup. Se libera un
  lugar (ver §6).

#### A5: Uso la plata de la meta (No, pero el backend lo soporta: HZ-13)
- **Brecha:** la app nunca envía `asignacionId`; el rodeo (gasto + liberar)
  no es descubrible y el avance de la meta queda inflado.
- **Patrón:** Monzo Pots (gastar desde el bolsillo) y YNAB (gastar con una
  categoría reduce esa categoría sola). El usuario dice **de dónde sale**; el
  sistema descuenta.
- **Aplicación (P-C):** en Registrar gasto, **solo si la cuenta de origen tiene
  plata apartada**, aparece "¿Sale de una meta?" con las metas de esa cuenta.
  Si elige una, se envía `asignacionId` y se aplica "Consumir reserva". Sin
  plata apartada, la pregunta no existe.
- **Dominio:** Ninguno. Es el arreglo de mejor relación costo/impacto de todo
  el benchmark.

#### A4: Mi Fintual rentó (Sí c/ conocimiento)
- **Brecha:** dos caminos (valorización o ajuste) según una configuración
  hecha al crear la cuenta; el ajuste obliga a calcular la diferencia.
- **Patrón:** Monarch y apps de patrimonio con cuentas manuales: un único
  **"Actualizar saldo"** donde se escribe el valor nuevo.
- **Aplicación (P-A):** un solo botón "Actualizar saldo" en el detalle. Por
  debajo: `RegistrarValorizacion` si `admiteValorizacion`, si no
  `RegistrarAjustePatrimonial` con la diferencia calculada por la app y el
  motivo prellenado ("Actualización de saldo"), editable.
- **Dominio:** Ninguno.

#### A7: Meta del hogar entre los dos (Sí c/ conocimiento)
- **Brecha:** "Guardar designados" es un paso aparte y no anunciado; si se
  omite, la pareja no puede aportar.
- **Patrón:** Monzo (bolsillos de cuenta conjunta) y metas compartidas en
  apps de pareja: **compartir implica poder aportar**; restringir es la
  excepción.
- **Aplicación (P-E):** al marcar "Compartir con el hogar", todos los
  miembros quedan designados por defecto. "Quién puede modificarla" pasa a
  Avanzado.
- **Dominio:** Ninguno (cambia el valor por defecto que envía la app).

### 3.2 Plata de otro: M8, M10, M9 (D-3 y HZ-11)

Estos tres son el núcleo de HIP-2 y el lugar donde el benchmark cambia más la
propuesta.

#### El patrón central: Splitwise y Tricount (P-B)
En Splitwise el usuario **nunca da de alta una deuda**. Registra un hecho
("Noira me pasó 30.000", "pagué 50.000 por mis papás") y la app mantiene un
**saldo por persona** que sube y baja con cada hecho hasta llegar a cero
("saldado"). La deuda es una consecuencia, no un paso previo.

YNAB aporta la otra mitad: un **reembolso se registra como algo que resta
gasto**, no como un ingreso, para no inflar el mes.

#### M8: Encargo de Noira (No; peor escenario del catálogo, suma 35)
- **Brecha:** hoy exige dar de alta una Deuda con 30.000 pendientes y
  después registrar la entrada como Ingreso, que el aviso prohíbe. La compra
  del labial no se anuncia como pago de la deuda.
- **Aplicación:** una sola entrada, **"Plata de otra persona"**, con dos
  hechos en lenguaje cotidiano:
  1. *"Noira me pasó 30.000 a Falabella"* → la cuenta sube, el saldo con Noira
     queda en "le debes 30.000". No es ingreso.
  2. *"Usé plata de Noira"* (o, en Registrar gasto, "¿Era plata de otra
     persona?" → Noira) → la cuenta baja, el saldo con Noira baja. No es gasto.
- **Dominio: DOMINIO (HZ-11).** Ver §4.

#### M10: Compro para mis papás y me devuelven (No)
- **Brecha:** la sugerencia de Crédito llega cuando la compra ya se registró
  como gasto; el usuario termina con Gasto + Ingreso.
- **Patrón:** Splitwise ("pagaste por otra persona") + YNAB (el reembolso
  resta gasto).
- **Aplicación (P-C):** en Registrar gasto, la opción **"Lo pagué por otra
  persona / me lo van a devolver"** (colapsada, un toque). Crea o aumenta el
  saldo "Mis papás: te deben X" en lugar de sumar gasto. La devolución se
  registra desde ese saldo ("Mis papás me pagaron") o desde Registrar
  ingreso, con la misma pregunta. Si la devolución llega sin que se haya
  marcado la compra, el patrón YNAB es el respaldo: la devolución puede
  **imputarse al gasto original** y restarlo.
- **Dominio: DOMINIO (HZ-11)**, el mismo arreglo que M8, en espejo (Crédito
  en vez de Deuda).

#### M9: Juan me pasa 100.000 para mi papá y agrego 100.000 míos (Sí c/ conocimiento)
- **Brecha:** Zoily ve un gasto de 200.000; la mitad era de paso.
- **Patrón:** Splitwise, "dividir por montos exactos".
- **Aplicación:** el mismo "¿Era plata de otra persona?" del gasto permite
  indicar **cuánto**: 100.000 de Juan, 100.000 míos. Como Juan es miembro del
  hogar, el saldo es con un miembro, no con un tercero.
- **Dominio:** con HZ-11 resuelto, el modelo alcanza para el patrimonio.
  **Queda abierta la atribución del gasto** (¿los 100.000 de Juan son gasto de
  Juan?). Es de baja frecuencia (T2); se recomienda no resolverla en la
  Fase D y registrarla como pregunta en D-3.

### 3.3 Movimientos del día a día: M7, M5, M6, M4

#### M7: Compro algo para la casa y mi pareja me pasa su parte (No; entre los 3 peores)
- **Brecha:** la instrucción "registra primero una transferencia desde su
  cuenta" no se puede cumplir desde el teléfono de quien la lee, y la app no
  dice quién debe hacerla.
- **Patrón:** Splitwise y Honeydue. **Registra quien pagó**, marca "dividido
  con…"; la otra persona recibe una **solicitud** y la salda con un toque.
- **Aplicación:** en Registrar gasto, "¿Lo compartes con [pareja]?" → mitad
  o monto. Se registra el gasto por el total y se genera una **solicitud
  pendiente** en el teléfono de la pareja ("Zoily pagó 50.000 en la casa; tu
  parte: 25.000 → Transferir"). Al confirmar, la pareja registra la
  TRANSFERENCIA desde su cuenta, como exige el backend. Nadie tiene que
  entender el orden.
- **Dominio:** Orquestación más un concepto nuevo: la **solicitud pendiente**.
  Se puede implementar como notificación con acción (el dominio ya tiene
  notificaciones, Principio 4) sin crear un agregado. Se propone registrarlo
  como decisión **D-7** (§5).

#### M5: Cuentas fijas todos los meses (Sí c/ conocimiento)
- **Brecha:** dos conceptos (plantilla y programado), ninguno recurrente.
- **Patrón:** YNAB (una transacción programada con "Repetir: mensual") y
  Splitwise (gastos recurrentes).
- **Aplicación (P-D):** en Registrar movimiento, un campo **"¿Se repite?"**
  (No / Cada mes / Cada año). El día indicado la app crea el movimiento
  pendiente y avisa "Luz 35.000 · ¿Se pagó? Confirmar / Cambiar monto". Las
  plantillas se retiran de la superficie como concepto: quedan como
  "Frecuentes" (los últimos movimientos repetibles, un toque) y las de hoy se
  migran a esa lista.
- **Dominio: DOMINIO (HZ-16):** `CrearMovimientoProgramado` no tiene
  periodicidad ni categoría. Se propone **D-6** (§5).

#### M6: Compro con tarjeta y la pago (Sí c/ conocimiento)
- **Brecha:** nada indica que la compra con tarjeta se registra eligiéndola
  como origen; pagarla desde `+` exige saber que es una transferencia hacia
  una deuda.
- **Patrón:** YNAB y Monarch. La tarjeta aparece **como una cuenta más**,
  agrupada bajo "Tarjetas"; pagarla es una acción con nombre propio ("Pagar
  tarjeta").
- **Aplicación:** en el selector de origen de Gasto, grupos "Cuentas" y
  "Tarjetas" (HZ-17). En el menú `+`, la intención **"Pagar tarjeta"** (P-A):
  preelige TRANSFERENCIA con destino en la tarjeta, como ya hace el botón del
  detalle.
- **Dominio:** Ninguno.

#### M4: Le transfiero a mi pareja para Netflix (Sí c/ conocimiento)
- **Brecha:** la cuenta de la pareja solo aparece si ella la marcó como
  visible; si no, la pantalla no explica por qué.
- **Patrón:** apps de pareja y bancarias: el destino es **la persona**, y
  luego su cuenta.
- **Aplicación:** en Transferencia, el destino muestra siempre a los miembros
  del hogar por nombre. Si la pareja no compartió cuentas: "Zoily todavía no
  compartió ninguna cuenta para recibir transferencias · Pedírselo"
  (notificación). Resuelve el vacío sin romper la privacidad.
- **Dominio:** Ninguno. Depende del nivel "Que puedan transferirme" de D-2.

### 3.4 Hogar: H3, H1, H4

#### H3: Transferencia mensual a la Falabella de Zoily (No; bloqueo de dominio)
- **Patrón:** el mismo de M5 (repetición como propiedad) + el de M4 (destino =
  persona).
- **Aplicación:** "¿Se repite? Cada mes" en una transferencia hacia un
  miembro del hogar.
- **Dominio: DOMINIO:** D-5 (propiedad del destino en plantillas y
  programados, G24/G2) + D-6 (recurrencia). No se arregla con mockup; se
  confirma lo que dijo el recorrido.

#### H1 y H4: Cuánta plata tenemos / qué ve mi pareja y qué suma (Sí c/ conocimiento)
- **Brecha:** visibilidad y consolidación son dos configuraciones con lenguaje
  de sistema; toda cuenta nace sin sumar.
- **Patrón:** Honeydue. Por cada cuenta, **una sola pregunta con niveles** en
  lenguaje cotidiano; lo que se comparte con saldo, suma al hogar.
- **Aplicación (P-E):** "¿Qué compartes de esta cuenta con el hogar?"
  1. **Nada**
  2. **Que puedan transferirme** (hoy: "Que existe = Familiar")
  3. **Que vean el saldo y sume al total del hogar** (hoy: "El monto =
     Familiar" + `participaConsolidacion = true`)
  4. **Todo, también los movimientos**

  Y en **Avanzado**, la combinación que el dominio permite pero es rara: "que
  vean el saldo sin sumar al total" (o al revés). El dominio sigue separando
  las dos ideas (§M); la superficie propone el valor coherente.
- **Dominio:** Ninguno. Resuelve **D-2** con la opción "derivar con
  excepción avanzada". La pestaña Hogar puede entonces mostrar las cuentas de
  nivel 2 como "Para transferir" sin montos, y deja de parecer que la
  visibilidad no hace nada.

### 3.5 Cuentas: C1, C2

#### C1: Agrego mi cuenta Falabella (Sí c/ conocimiento; puerta de todo, HZ-9)
- **Brecha:** empieza por "Tipo", el nombre va al final, "Valor inicial" = 0
  por defecto, advertencia falsa de irreversibilidad (HZ-14) y tres preguntas
  del hogar.
- **Patrón:** YNAB y Monarch, cuentas manuales. **Una pantalla, tres datos:**
  nombre, tipo (chips), **saldo actual** (obligatorio, sin 0 por defecto).
  Lo demás queda con valores por defecto y se edita después.
- **Aplicación:** paso único: "¿Cómo se llama?" → tipo en chips (Cuenta
  corriente, Cuenta vista, Ahorro, Inversión, Tarjeta, Otro) → "¿Cuánto tiene
  hoy?". La categoría y "¿se valoriza?" se derivan del tipo. La pregunta del
  hogar (nivel de P-E) aparece **después de crear**, como una tarjeta
  opcional: "¿La compartes con el hogar?".
- **Dominio:** Ninguno (`RegistrarElementoPatrimonial` + `SALDO_INICIAL`).

#### C2: Agrego mi tarjeta con lo que debo (Sí c/ conocimiento)
- **Patrón:** YNAB y Monarch. Tarjeta = nombre + **"¿Cuánto debes hoy?"**.
- **Aplicación:** el tipo "Tarjeta de crédito" fija `naturaleza =
  FINANCIERA`: la pregunta "Financiera / Encargo o custodia" desaparece.
  Acreedor, término y cuota pasan a opcionales en el detalle.
- **Dominio:** Ninguno.

### 3.6 Planificación: P1

#### P1: Presupuesto del mes (Sí c/ conocimiento)
- **Brecha:** cuatro decisiones antes de poner un monto, y tres montos
  (ingreso, gasto, ahorro) en vez de uno.
- **Patrón:** Monarch ("presupuesto flexible": un solo número para el gasto
  del mes) y YNAB (mensual por defecto).
- **Aplicación:** "¿Cuánto quieres gastar como máximo este mes?" (un número).
  Por defecto: individual, periódico, mensual, moneda del usuario. Montos por
  categoría y "Familiar" quedan como segundo paso opcional.
- **Dominio:** Ninguno (valores por defecto).

---

## 4. HZ-11 en detalle: la decisión de dominio central de D-3

**Problema (verificado en B):** `RegistrarElementoPatrimonial` exige
`valorPendiente > 0` para DEUDA y CRÉDITO y no mueve plata. Por eso la
contrapartida de M8 y M10 solo puede ser un INGRESO o un GASTO.

**Lo que muestra el benchmark:** en Splitwise la deuda **nace del movimiento**,
no antes. Aplicado al dominio actual, el asiento correcto ya existe:

- M8: TRANSFERENCIA **desde** la deuda de Noira **hacia** Falabella → la cuenta
  sube 30.000 y la deuda sube 30.000. Patrimonio neto sin cambio, sin
  ingreso. (El recorrido lo confirma para M6: un origen DEUDA aumenta la deuda.)
- M10: TRANSFERENCIA desde la cuenta **hacia** el crédito de los papás → la
  cuenta baja, el crédito sube. Sin gasto.

El único bloqueo es que la deuda o el crédito no pueden existir con
pendiente 0 antes de ese primer movimiento.

**Opciones:**

| Opción | Qué cambia | Costo | Riesgo |
|--------|-----------|-------|--------|
| (a) Relajar la invariante a `valorPendiente ≥ 0` en general | Una regla | Bajo | Aparecen deudas "vacías" creadas a mano, sin sentido |
| (b) Servicio de aplicación **"Registrar plata de otra persona"**: alta con pendiente 0 + la TRANSFERENCIA que la origina, en **una transacción** | La invariante admite 0 **solo** dentro de esta orquestación; comandos intactos | Medio | Bajo; misma forma que D-1 |
| (c) Crear la deuda con 30.000 + un evento nuevo de "entrada sin ingreso" | Nuevo tipo de evento | Alto | Duplica lo que TRANSFERENCIA ya expresa |

**Decisión de Juan (2026-09-29): opción (b), aceptada.** Es el mismo patrón que D-1: el dominio no cambia sus
comandos, se agrega una orquestación con una sola auditoría encadenada, y la
invariante se protege estructuralmente (nadie crea deudas vacías a mano).
Además, **un solo saldo por persona** (P-B) se consigue reutilizando la deuda
o el crédito existente con esa contraparte, en lugar de crear uno por hecho.

**Caso borde que la Fase D tiene que decidir:** si el saldo con una persona
cruza de "le debo" a "me debe" (Splitwise lo permite). Con Deuda y Crédito
separados, eso implica saldar uno y abrir el otro. Frecuencia baja;
recomendación: la orquestación lo maneja y la superficie muestra un solo
saldo con signo.

---

## 5. Hallazgos propuestos HZ-11 a HZ-17: recomendación

**Cerrado (2026-09-29).** Juan aceptó la opción (b) para HZ-11 y no objetó el
resto de las recomendaciones de esta tabla, así que se toman como aprobadas.
Si alguna no lo está, se corrige antes de la Tarea 5.

| ID | Tipo propuesto | Recomendación | Razón |
|----|----------------|---------------|-------|
| HZ-11 | DOMINIO | **Incorporar** a §4 y a `GAPS.md` bajo G33 / D-3, con la opción (b) de §4 como propuesta | Sin esto, M8 y M10 no tienen solución, con o sin rediseño |
| HZ-12 | UI | **Incorporar**; se resuelve dentro de D-3 (el enlace desaparece con la entrada única) | No merece trabajo propio: queda absorbido |
| HZ-13 | FLUJO | **Incorporar**; primer candidato de la Fase E | Backend listo; costo mínimo, desbloquea A5 |
| HZ-14 | **BUG** (no UI) | **Incorporar reclasificado como BUG** y corregir por la vía paralela, como BUG-HOG | Es un texto falso, no una decisión de diseño; está en el asistente que Zoily abandonó |
| HZ-15 | UI | **Incorporar**; se resuelve con P-C | Consistente con §2 |
| HZ-16 | DOMINIO | **Incorporar** a `GAPS.md` y abrir **D-6** | Bloquea M5 y H3 (dos T1) |
| HZ-17 | UI | **Incorporar** marcado "amplía HZ-3" | Mismo arreglo de listas: agrupar por tipo, destino = persona |

**Decisiones nuevas propuestas (se resuelven en la Fase D, no antes):**

- **D-6: Recurrencia de movimientos programados (HZ-16).** Agregar
  periodicidad y categoría a `CrearMovimientoProgramado`, con materialización
  por confirmación ("¿Se pagó?"), no automática. Recomendación: sí; la
  confirmación mantiene el principio de que el usuario registra hechos.
- **D-7: Solicitud de aporte entre miembros (M7).** Cómo se representa "tu
  parte: 25.000 → Transferir". Recomendación: notificación con acción (reusa
  Principio 4) antes que un agregado nuevo.

---

## 6. Implicaciones para la Fase D

1. **Mockups:** A1 y A2 son uno solo ("Ahorrar"). El lugar liberado es para
   **M8**, que además ya está en la señal de validación (M1, M8, A1, M7). Los
   tres flujos del mockup quedan en: **Ahorrar (A1/A2), Compartido con la
   pareja (M7), Plata de otra persona (M8)**.
2. **C1 entra en el rediseño aunque no esté entre los peores.** La prueba de
   la Fase E con Zoily empieza creando cuentas en la app real; si C1 no
   cambia, la prueba vuelve a fallar en la puerta (HZ-9).
3. **El menú `+` pasa a ser de intenciones** (P-A): Gasté · Recibí · Moví
   entre mis cuentas · Ahorrar para una meta · Pagar tarjeta · Plata de otra
   persona. El tipo contable deja de ser la primera decisión (HIP-1).
4. **Orden sugerido de la Fase E** (de mayor impacto y menor riesgo a menor):
   HZ-13 (A5) → C1 + D-2 (P-E) → "Ahorrar" (D-1) → "Plata de otra persona"
   (D-3/HZ-11) → M7 (D-7) → recurrencia (D-6/D-5).

## 7. Validación de la Fase C

Señal de §6 de `USABILIDAD_REAL_S01.md`: *cada brecha de B tiene al menos un
patrón externo concreto aplicable.*

| Escenario | Veredicto B | Patrón (§2) | Referencia | Impacto dominio |
|-----------|-------------|-------------|------------|-----------------|
| A2 | No | P-A | YNAB, Monzo | Orquestación (D-1) |
| M7 | No | P-B | Splitwise, Honeydue | Orquestación + D-7 |
| A1 | No | P-A | Fintual, Monzo, Nubank | Orquestación (D-1) |
| H3 | No | P-D | YNAB | DOMINIO (D-5, D-6) |
| M8 | No | P-B | Splitwise, Tricount | DOMINIO (HZ-11) |
| M10 | No | P-B + P-C | Splitwise, YNAB | DOMINIO (HZ-11) |
| A5 | No | P-C | Monzo, YNAB | Ninguno |
| M5 | Sí c/ c. | P-D | YNAB, Splitwise | DOMINIO (D-6) |
| M6 | Sí c/ c. | P-A | YNAB, Monarch | Ninguno |
| M4 | Sí c/ c. | P-E | Apps de pareja | Ninguno |
| A4 | Sí c/ c. | P-A | Monarch | Ninguno |
| H1 | Sí c/ c. | P-E | Honeydue | Ninguno |
| C2 | Sí c/ c. | P-A | YNAB, Monarch | Ninguno |
| M9 | Sí c/ c. | P-B | Splitwise | DOMINIO (HZ-11) + pregunta abierta |
| P1 | Sí c/ c. | P-A | Monarch, YNAB | Ninguno |
| C1 | Sí c/ c. | P-A | YNAB, Monarch | Ninguno |
| A7 | Sí c/ c. | P-E | Monzo | Ninguno |
| H4 | Sí c/ c. | P-E | Honeydue | Ninguno |

**Resultado:** 18 de 18 brechas con al menos un patrón concreto y las
recomendaciones de §5 cerradas. **Señal cumplida: Fase C cerrada
(2026-09-29).**

## 8. Instrucciones para Claude Code (registro, directo a `main`)

§5 ya está confirmado. Sin cambios de código.

**Tarea 5: Registrar la Fase C**
- Guardar este archivo en `Docs/usabilidad/BENCHMARK_S01.md` y agregarlo al
  índice de `Docs/README.md`.
- `USABILIDAD_REAL_S01.md`: marcar la Fase C como cerrada en §0; incorporar a
  §4 los HZ-11 a HZ-17 **con la decisión de Juan** (tipo final incluido);
  agregar D-6 y D-7 a §9; actualizar §11.
- `GAPS.md` bajo G33: HZ-11 y HZ-16 como `DOMINIO`; D-6 y D-7 como
  `📋 DECISIÓN`.
- Si Juan aprueba HZ-14 como BUG: abrir la rama `fix/valoriza-advertencia` y
  corregir solo el texto del asistente. *Rollback:* descartar la rama.
- *Señal:* un commit en `main` con los documentos y `git diff` sin cambios de
  código (más la rama del bug, si aplica).
