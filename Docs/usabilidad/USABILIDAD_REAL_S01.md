# Usabilidad real — Sesión 01 (G32, validación con persona nueva)

**Objetivo de este archivo:** registrar el resultado de la primera prueba de la
app con una usuaria real que no conoce el dominio. Define el catálogo de
escenarios y el plan para rediseñar la experiencia de uso **sin tocar el modelo
de dominio**, y deja instrucciones operativas para Claude Code.

- **Ubicación en el repo:** `Docs/usabilidad/USABILIDAD_REAL_S01.md`
- **Fecha:** 2026-09-29 · **Versión:** 3 (catálogo validado; instrucciones de ejecución para Claude Code)
- **Línea base probada:** commit `95e5b9f` (ajustes G32 ya aplicados).
- **Relación con otros documentos:** continúa
  `Docs/diseño/EVALUACION_USABILIDAD.md`, que fue una evaluación heurística sin
  personas. Esta es la validación con una persona real que G32 dejaba
  pendiente. **Resultado: la validación falló.**

---

## 0. Estado y cómo usar este documento

**Si eres Claude Code, lee esto primero.** Este documento es la fuente de
verdad de este frente de trabajo. Léelo completo y después ejecuta **§10
(instrucciones de ejecución)** en orden. No saltes tareas ni adelantes fases.

### Decisiones cerradas en la sesión 01

| # | Decisión | Estado |
|---|----------|--------|
| 1 | La validación G32 con persona nueva se hizo y **falló**. Se abre G33. | ✅ Cerrada |
| 2 | Principio rector (§2): superficie muy simple, dominio intacto por debajo. | ✅ Cerrada |
| 3 | La unidad de prueba es el **escenario real completo**, agrupado por área (Movimientos, Metas, Hogar, Cuentas, Planificación). No se prueba pantalla por pantalla. | ✅ Cerrada |
| 4 | Catálogo de 33 escenarios con frecuencia T1/T2/T3 (§5). | ✅ Validado por Juan |
| 5 | Plan por fases A–E más la vía paralela BUG-HOG (§6). | ✅ Aprobado |
| 6 | La Fase B la ejecuta Claude Code en solo lectura. La Fase C (benchmark) la hace Claude en el chat, con el resultado de B. | ✅ Cerrada |
| 7 | BUG-HOG no espera las fases. Si la causa es la 1 (consolidación nunca activada), no se corrige en código ni en datos hasta resolver D-2. | ✅ Cerrada |
| 8 | Las decisiones D-1 a D-7 (§9) quedan **abiertas** hasta la Fase D. No implementarlas. | ✅ Cerradas en la Fase D, bloque 1 ([`DECISIONES_FASE_D_S01.md`](DECISIONES_FASE_D_S01.md) §1); se implementan en la Fase E |
| 9 | HZ-11 (plata de otra persona): opción (b) de `BENCHMARK_S01.md` §4, orquestación "Registrar plata de otra persona". Resto de recomendaciones de su §5 aprobadas. | ✅ Cerrada (Juan, 2026-09-29) |

### Estado de las fases

| Fase | Estado |
|------|--------|
| A — Catálogo | ✅ Cerrada (2026-09-29) |
| BUG-HOG | ✅ Cerrada (2026-09-29): causa 1 confirmada y activada desde la app; corrección defensiva en `63005d1` |
| B — Recorrido | ✅ Cerrada (2026-09-29): `RECORRIDO_ESCENARIOS_S01.md` (28 escenarios T1/T2; peores: A2, M7, A1) |
| C — Benchmark | ✅ Cerrada (2026-09-29): `BENCHMARK_S01.md` (18 brechas → 5 patrones P-A a P-E; HZ-11 a HZ-17; D-6 y D-7) |
| D — Rediseño y mockup | ✅ Cerrada (2026-10-02): bloque 1 (decisiones, [`DECISIONES_FASE_D_S01.md`](DECISIONES_FASE_D_S01.md)) y bloque 2 (prototipo v5; Zoily completó 6 de 6, HZ-18 a HZ-23, D-8). Ver [`CIERRE_FASE_D_S01.md`](CIERRE_FASE_D_S01.md) |
| E — Implementación | ▶ En curso: bloque 1 (D-4, HZ-19, HZ-22) ✅ (2026-10-03); siguiente: bloque 2 (orden en [`CIERRE_FASE_D_S01.md`](CIERRE_FASE_D_S01.md) §5 y en §11) |

---

## 1. Resultado en una frase

La usuaria no logró completar ningún flujo por sí sola. La navegación
principal (tabs, configuración, datos del hogar) se entiende bien. Lo que se
rompe es **la operación**: registrar, ahorrar y transferir. Pierde coherencia
entre pasos y usa conceptos que no calzan con cómo piensa una persona común.
Con este nivel de dificultad, no es viable que lleve el control de sus gastos
ni de los del hogar durante un mes.

## 2. Principio rector (no negociable)

> El dominio puede seguir siendo complejo por debajo. La superficie tiene que
> ser **muy simple y muy intuitiva**. El usuario siempre evita lo que le cuesta
> más esfuerzo del necesario. Una funcionalidad que no se entiende es una
> funcionalidad muerta.

Consecuencias:

- El rediseño cambia **cómo se presentan y encadenan** las operaciones. No
  cambia invariantes, comandos ni reglas de negocio, salvo que un hallazgo se
  marque explícitamente como `DOMINIO` y se decida en `GAPS.md`.
- **"Cubrir la mayoría de las situaciones" lo resuelve el dominio, que ya es
  completo. La superficie no tiene que mostrarlo todo.** Por eso cada escenario
  lleva una frecuencia (T1/T2/T3, §5). Lo frecuente va al frente y en pocos
  pasos; lo raro vive en el detalle o en Ajustes. Si todo compite por el mismo
  espacio, vuelve el problema que tuvo Zoily.

## 3. Modelo mental del usuario

El usuario registra **hechos** con cuatro datos: monto, fecha, cuenta y para
qué. No clasifica contablemente antes de registrar. Estos son los casos de
Zoily, en sus palabras:

1. "Gasté 10.000 pesos el 18 de septiembre en un helado. Lo pagué con mi
   CuentaRUT."
2. "Mi amiga Noira me transfirió 30.000 a mi cuenta Falabella para que le
   comprara un labial. Después usé esos 30.000 para comprárselo."
3. "Juan me transfirió 100.000 para que se los enviara a mi papá desde mi
   cuenta. Le envié esos 100.000 y 100.000 más míos."
4. "Tengo un millón en Falabella y lo transfiero a Fintual, a mi meta Hogar."

Y los de Juan:

5. "Le compro algo a mis papás y ellos me devuelven el dinero, en el mismo mes
   o en otro."
6. "De mi sueldo transfiero a Fintual. No lo *aparto*: la plata se va de
   verdad, el saldo de mi cuenta baja y la cuenta Fintual con la meta Hogar
   sube. Patrimonialmente es solo un movimiento, no una salida; pero
   conceptualmente salió de una cuenta y llegó a otra."

### Hipótesis a validar (no son decisiones)

- **HIP-1 — Hecho primero, clasificación después (o implícita).** La app pide
  decidir qué tipo de operación contable es antes de dejar anotar. El flujo
  debería partir desde el hecho y deducir o proponer la clasificación.
- **HIP-2 — "Plata de otro" es una sola familia.** Los casos 2, 3 y 5 son lo
  mismo para el usuario: plata que no es mía y pasa por mi cuenta, o plata
  mía que alguien me va a devolver. El dominio los modela distinto (custodia
  informal, transferencia entre miembros, Crédito). La superficie debería
  ofrecer **una sola entrada** con lenguaje cotidiano ("Me deben", "Es plata
  de otra persona") y resolver el modelo por debajo.
- **HIP-3 — Una sola palabra para ahorrar.** Reserva, apartado y objetivo son
  tres conceptos que la usuaria no distingue. De cara al usuario debería
  existir un único concepto (por ejemplo "Meta"), con la mecánica interna
  (asignación, reserva, objetivo) oculta.
- **HIP-4 — Ahorrar es mover plata a la meta (respaldado por los propios
  requisitos).** Ver §3.1.

### 3.1 Evidencia de HIP-4: el requisito original ya lo decía

- `REQUISITES.md` → "Caso de uso típico": *"Aparto dinero para ahorro
  provisional 'mantención auto', entonces **transfiero dinero** desde mi
  cuenta corriente a mi cuenta de Fintual **a un ítem con el mismo
  nombre**."* Para el usuario, "apartar" siempre fue una transferencia real
  hacia una meta.
- `UX_FLOWS.md` → Flujo 1, pasos 5 y 7: el diseño lo modeló correctamente
  como **dos hechos**: un `RegistrarEventoFinanciero` TRANSFERENCIA (la plata
  se mueve) seguido de `CrearAsignacion` + `CrearReserva` (la plata movida
  queda comprometida para la meta).
- **La app implementó solo la segunda mitad como acción de ahorro.**
  `ObjetivoDetalleScreen` → "Apartar dinero" reserva saldo de una cuenta
  existente, sin transferencia. La transferencia vive desconectada en
  Registrar movimiento. El usuario tiene que saber que son dos operaciones,
  hacerlas en dos pantallas distintas y en el orden correcto.
- `REQUISITES.md` §G sigue siendo válido: también existe el ahorro *virtual*
  (apartar dentro de la misma cuenta, sin mover plata). Los dos casos son
  legítimos. El problema es que hoy **solo el virtual tiene una entrada
  directa**, y es el menos frecuente.

**Implicación:** no hace falta cambiar el dominio. Falta una **operación de
usuario** que componga los hechos que el dominio ya tiene: "Ahorrar para una
meta" con origen, destino, monto y meta. Si origen y destino son distintos, es
una transferencia más la reserva en destino. Si son la misma cuenta, es solo
la reserva. La decisión de cómo orquestarlo está en §9, D-1.

## 4. Hallazgos

Tipos: `UI` = presentación e interacción · `FLUJO` = orden o encadenamiento
de pasos · `DOMINIO` = requiere decisión de dominio (se registra en GAPS) ·
`BUG` = comportamiento incorrecto · `PROYECCIÓN` = cómo se calcula o
resume una cifra que ve el usuario.

| ID | Área | Tipo | Hallazgo |
|----|------|------|----------|
| HZ-1 | Movimientos | FLUJO | Préstamo o encargo de un tercero (Noira → 30.000 → compra del labial). No encontró cómo registrarlo como plata de un tercero. Cuando intentó crearlo, los pasos fueron confusos y no pudo terminar. |
| HZ-2a | Movimientos | UI | Al registrar un gasto aparece una leyenda genérica ("alguien te aportó"). Debe decir explícitamente algo como *"¿Un miembro del hogar te ayudó a pagar este gasto?"*. |
| HZ-2b | Movimientos / Hogar | FLUJO | La instrucción de registrarlo como transferencia de esa persona hacia ti es correcta, pero no queda claro **qué sigue**: quién registra qué, si la otra persona también debe registrar la transferencia para que se le descuente, o si basta con uno. |
| HZ-3 | Transversal | UI | Las listas de selección (categorías, elementos, cuentas) hacen scroll de toda la pantalla y el usuario pierde contexto. **Decisión (Fase E, bloque 2):** listas de selección de más de 6 opciones usan `Select` (hoja modal con buscador y scroll propio). 6 o menos: opciones visibles en línea. La pantalla nunca crece por una lista. Aplica a toda la app. (Reemplaza la solución original, "scroll interno con altura acotada"; ver `GAPS.md`, G33.) |
| HZ-4 | Metas | UI | Al apartar dinero se pueden elegir cuentas con disponible cero (por ejemplo Fintual ya apartada al 100%). El error aparece recién al confirmar. La cuenta debe seguir **visible pero deshabilitada (gris)**, mostrando su saldo y que el disponible es cero porque está apartado. No ocultarla, por transparencia. |
| HZ-5 | Metas / Hogar | DOMINIO | En plantillas, una transferencia solo permite elegir **cuentas propias** como destino. Deberían aparecer las cuentas que otros miembros compartieron con el hogar, agrupadas o etiquetadas por dueño ("Mías" / "Zoily" / …). Toca visibilidad y autorización sobre elementos ajenos. Nota: Registrar movimiento sí ofrece cuentas del hogar en TRANSFERENCIA; revisar por qué las plantillas no. |
| HZ-6 | Hogar / Inicio | BUG | En la vista del hogar, las cuentas compartidas aparecen pero **el total del hogar queda en cero**. Ver §7 (vía paralela BUG-HOG). |
| HZ-7 | Transversal | FLUJO | Las operaciones pierden coherencia entre pasos. Reserva, apartado y objetivo no se entienden (HIP-3). |
| HZ-8 | Metas | FLUJO | Ahorrar solo existe como "apartar" (reserva virtual). La transferencia real a una cuenta de inversión con meta, que es el caso más frecuente, no tiene una entrada de ahorro (§3.1). |
| HZ-9 | Cuentas | FLUJO | Agregar una cuenta (C1) también resultó confuso: la usuaria avanzó bastante en el asistente, pero no lo terminó. No quedó ninguna cuenta a su nombre (confirmado en la base, §7). La Fase B debe recorrer C1 con prioridad, aunque sea T2, porque sin cuentas no se puede probar nada más. |
| HZ-10 | Cuentas / Hogar | UI | Visibilidad y "Cuenta en el patrimonio del hogar" no se entienden ni siquiera para el autor (Juan, 2026-09-29). (1) "Que existe", "El monto" y "Familiar" son lenguaje de sistema: no dicen para qué sirven (en la práctica, "Que existe" permite que el otro miembro te transfiera a esa cuenta). (2) La visibilidad solo afecta lo que ven *otros*, así que el dueño nunca ve su efecto. (3) `HogarScreen` filtra las cuentas visibles del hogar por `participaConsolidacion`: una cuenta visible con saldo, pero que no suma, no aparece en la pestaña Hogar, y parece que la visibilidad no hace nada. La pantalla mezcla dos ideas que el dominio separa (§M). Ver D-2. |
| HZ-11 | Movimientos | DOMINIO | El alta de una Deuda o un Crédito exige `valorPendiente > 0` y no mueve plata, así que la contrapartida de M8 y M10 solo puede ser INGRESO o GASTO (infla el mes). **Decisión de Juan (2026-09-29):** opción (b) de `BENCHMARK_S01.md` §4, un servicio de aplicación "Registrar plata de otra persona" (alta con pendiente 0 + la TRANSFERENCIA que la origina, en una transacción; un solo saldo por persona). Se implementa dentro de D-3. |
| HZ-12 | Movimientos | UI | El enlace del aviso de Ingreso abre el asistente con "Crédito por cobrar", aunque el caso típico (M8) es una Deuda; ningún tipo sembrado sirve para un encargo. **Decisión:** incorporar; queda absorbido por D-3 (el enlace desaparece con la entrada única). |
| HZ-13 | Metas | FLUJO | El backend soporta gastar la plata de una meta (`asignacionId`, política "Consumir reserva"), pero la app nunca lo ofrece; A5 no tiene entrada. **Decisión:** incorporar; primer candidato de la Fase E. |
| HZ-14 | Cuentas | BUG | El asistente de alta dice que "¿Se valoriza en el tiempo?" no se puede cambiar después, pero Editar lo permite (`CambiarAdmiteValorizacion`). **Decisión:** reclasificado de UI a BUG (texto falso); se corrige por la vía paralela en la rama `fix/valoriza-advertencia`, como BUG-HOG. |
| HZ-15 | Movimientos | UI | Los avisos de Gasto y de Ingreso para casos T2 aparecen en el 100% de los registros T1. **Decisión:** incorporar; se resuelve con divulgación contextual (P-C). |
| HZ-16 | Planificación / Hogar | DOMINIO | Los movimientos programados no tienen recurrencia ni categoría; "todos los meses" (M5, H3) obliga a crear uno por mes. **Decisión:** incorporar a `GAPS.md` y abrir D-6 (§9). |
| HZ-17 | Movimientos | UI | En Registrar movimiento, "Desde" y "Hacia" mezclan todos los elementos, en Transferencia la lista sale dos veces y la cuenta queda bajo todas las categorías. **Decisión:** incorporar; amplía HZ-3 (agrupar por tipo, destino = persona). |
| HZ-18 | Inicio / Cuentas | PROYECCIÓN | "Disponible" (pasa a llamarse "Libre para gastar") incluye plata de terceros e invita a gastarla. **Fase E:** restar del libre el total de deudas por plata de terceros (D-3) y avisar cuánta plata ajena hay en las cuentas. Detalle en [`CIERRE_FASE_D_S01.md`](CIERRE_FASE_D_S01.md) §3. |
| HZ-19 | Transversal | UI | En tema oscuro no se percibe el orden de los pasos de un formulario. **Fase E:** numerar los pasos de forma sutil. |
| HZ-20 | Movimientos | FLUJO | No hay cómo recuperarse de un registro mal clasificado (un ingreso que era plata de otra persona). **Fase E:** corregir desde el flujo siguiente: anular el ingreso y registrarlo con D-3 en una sola transacción; si no estaba anotado, registrar ambos hechos. |
| HZ-21 | Hogar | UI / PROYECCIÓN | Ningún lugar muestra lo que pasa entre los miembros del hogar. **Fase E:** "Entre [pareja] y tú" en Hogar: solicitudes (D-7) y transferencias entre miembros. Solo lectura; no reabre la atribución por persona. |
| HZ-22 | Transversal | UI | Una decisión de uso frecuente al final del formulario, con un valor ya elegido, no se descubre. **Regla de diseño (Fase E):** la decisión que cambia el significado del registro va en el paso 2. |
| HZ-23 | Movimientos | UI | El menú con una puerta por caso ("Gasto compartido", cuatro variantes de "Plata de otra persona") no calza con cómo piensa la usuaria (primero la dirección de la plata, después de quién era) y no escala a más miembros. **Resuelto con D-8** (§9). |

## 5. Catálogo de escenarios de prueba

Los escenarios son **la unidad de prueba**. Se agrupan por área para
organizar el rediseño, pero se prueban completos de principio a fin, porque
cruzan pantallas.

**Estado:** ✅ validado por Juan (2026-09-29). No agregar ni quitar
escenarios sin su aprobación.

**Frecuencia:** `T1` = semanal o mensual (tiene que ser rápido y estar a la
vista) · `T2` = ocasional (unas pocas veces al año) · `T3` = raro o avanzado
(puede vivir en el detalle o en Ajustes).

**Fuente:** `Z` = prueba con Zoily · `J` = Juan · `R` = `REQUISITES.md` (caso
de uso típico o sección) · `U` = `UX_FLOWS.md`.

La columna "Dominio hoy" dice qué hechos registra el modelo. Es **referencia
para la Fase B, no una propuesta de UI**. Lo marcado con *(verificar)* no pudo
confirmarse en los documentos y Claude Code debe comprobarlo en el código.

### 5.1 Movimientos — el día a día

| ID | Escenario (palabras del usuario) | Frec. | Fuente | Dominio hoy |
|----|----------------------------------|-------|--------|-------------|
| M1 | Gasté 10.000 en un helado el 18-sep con mi CuentaRUT | T1 | Z | GASTO |
| M2 | Me llegó el sueldo a la cuenta corriente | T1 | R | INGRESO |
| M3 | Paso plata de mi cuenta corriente a mi CuentaRUT | T1 | R | TRANSFERENCIA entre cuentas propias |
| M4 | Le transfiero a mi pareja para que pague Netflix | T1 | R | TRANSFERENCIA a cuenta de otro miembro (requiere que sea visible) |
| M5 | Pago cuentas fijas (luz, Spotify) todos los meses | T1 | R | GASTO; plantilla o movimiento programado |
| M6 | Compro con la tarjeta de crédito y después pago la tarjeta | T1 | J | Tarjeta = elemento DEUDA; compra = GASTO desde la deuda *(verificar)*; pago = TRANSFERENCIA hacia la deuda |
| M7 | Compro algo para la casa y mi pareja me pasa su parte | T1 | Z, R | Patrón "transferencia primero": TRANSFERENCIA del otro miembro + GASTO por el total (G30) |
| M8 | Noira me transfiere 30.000 para que le compre un labial y se lo compro | T2 | Z, R | Deuda `CUSTODIA_INFORMAL` (G28): entra la plata, sube la deuda; la compra la salda |
| M9 | Juan me pasa 100.000 para mi papá; se los envío y agrego 100.000 míos | T2 | Z | TRANSFERENCIA de miembro + GASTO de 200.000 *(la parte "de paso" no queda explícita; ver HIP-2)* |
| M10 | Le compro algo a mis papás y me devuelven (mismo mes u otro) | T2 | J, R, U | GASTO o Crédito: `UX_FLOWS` Flujo 1 paso 6 sugiere crear un Crédito para no inflar gastos ni ingresos; la devolución lo salda |
| M11 | Pagué algo en dólares / cambié plata | T3 | R | CONVERSION + tipo de cambio |
| M12 | Me equivoqué en un monto y lo corrijo | T2 | Z, U | `CorregirEventoFinanciero` (entrada compensatoria) |
| M13 | Registré algo que no pasó y lo borro | T2 | U | `AnularEventoFinanciero` |

### 5.2 Metas y ahorro

| ID | Escenario | Frec. | Fuente | Dominio hoy |
|----|-----------|-------|--------|-------------|
| A1 | Transfiero plata de mi cuenta a Fintual, a mi meta Hogar | T1 | Z, J, R | TRANSFERENCIA + reserva en destino hacia el objetivo (§3.1). **Hoy no hay entrada única.** |
| A2 | Fin de mes: junto lo que sobra de dos cuentas y lo mando a la meta | T1 | R | 2 × TRANSFERENCIA + ajuste de reserva |
| A3 | ¿Cuánto llevo para la meta y cuánto me queda libre para gastar? | T1 | Z, R §H | Progreso del objetivo + valor libre |
| A4 | Mi Fintual rentó; actualizo cuánto vale | T1 | J | `RegistrarValorizacion` (si admite) o Ajuste *(verificar cuál ofrece la app)* |
| A5 | Uso la plata de la meta (compro el pasaje de las vacaciones) | T2 | R §F.4–8 | GASTO asociado a la asignación; política "Consumir reserva" (consumo parcial, G14) *(verificar entrada en la app)* |
| A6 | Separo plata para algo sin moverla de mi cuenta (fondo virtual) | T2 | R §G | `CrearReserva` sobre la misma cuenta (lo que hoy es "Apartar") |
| A7 | Creamos una meta del hogar y aportamos los dos | T2 | G13 | Objetivo compartido con el hogar + reservas de cada uno |
| A8 | Cumplí la meta / la quiero reabrir | T3 | U | Política "Completar objetivo" + `CambiarEstadoObjetivoFinanciero` |

### 5.3 Hogar

| ID | Escenario | Frec. | Fuente | Dominio hoy |
|----|-----------|-------|--------|-------------|
| H1 | ¿Cuánta plata tenemos como hogar? | T1 | Z | Consolidado del hogar (**bug HZ-6**) |
| H2 | ¿Cuánto gastamos este mes, yo y el hogar? | T1 | Z | Resumen financiero por alcance Míos / Del hogar |
| H3 | Juan programa una transferencia mensual a la Falabella de Zoily | T1 | J | Plantilla o programado con destino de otro miembro (**HZ-5**) |
| H4 | Decido qué ve mi pareja de mis cuentas y qué suma al hogar | T2 | R §I, §M | **Dos configuraciones distintas**: visibilidad (qué ve) y participación en consolidación (qué suma). Ver §7. |
| H5 | Tenemos una deuda juntos (hipotecario o auto) y la pagamos | T2 | U Flujo 4 | Elemento DEUDA compartido con % + pagos |
| H6 | Invito a mi pareja / acepto la invitación | T3 | U Flujo 2 | `InvitarMiembro` / `AceptarInvitacion` |

### 5.4 Cuentas y bienes

| ID | Escenario | Frec. | Fuente | Dominio hoy |
|----|-----------|-------|--------|-------------|
| C1 | Agrego mi cuenta Falabella con su saldo actual | T2 | Z | `RegistrarElementoPatrimonial` + saldo inicial (G29) |
| C2 | Agrego mi tarjeta de crédito con lo que debo | T2 | J | Elemento DEUDA `FINANCIERA` con `valorPendiente` |
| C3 | Agrego el auto o la casa y actualizo su valor una vez al año | T3 | U Flujo 3 | Elemento con valorización |
| C4 | Cerré una cuenta | T3 | — | `DesactivarElementoPatrimonial` |

### 5.5 Planificación

| ID | Escenario | Frec. | Fuente | Dominio hoy |
|----|-----------|-------|--------|-------------|
| P1 | Me pongo un presupuesto del mes y veo si me pasé | T2 | R §N | Presupuesto periódico + desviación por rubro |
| P2 | Dejo anotado un pago futuro (arriendo, dividendo) | T2 | — | Movimiento programado + materializar |

**Alcance de la Fase B:** todos los T1 y T2 (29 escenarios). De los T3 solo se
verifica que exista un camino, sin recorrerlos a fondo.

**Equivalencia con la versión 1:** E1→M1 · E2→M8 · E3→M9 · E4→M7 · E5→A1 ·
E6→A3 · E7→H3 · E8→H1 · E9→H2 · E10→C1 · E11→M12.

## 6. Plan por fases

Cada fase se valida antes de pasar a la siguiente. Si falta la señal de
validación, se detiene y se corrige esa fase.

| Fase | Objetivo | Responsable | Señal de validación |
|------|----------|-------------|---------------------|
| **A** | Catálogo de escenarios (§5) | Juan | Juan confirma el catálogo y las frecuencias T1/T2/T3. |
| **B** | Recorrido real de cada escenario en el código de la app | **Claude Code** | `RECORRIDO_ESCENARIOS_S01.md` con los 29 escenarios T1/T2 en el formato de §8. |
| **C** | Benchmark dirigido a las brechas de B: Fintual (metas como destino), Splitwise o Tricount (plata de terceros, gastos compartidos), apps de pareja u hogar | Claude (chat) | Cada brecha de B tiene al menos un patrón externo concreto aplicable. |
| **D** | Propuesta de rediseño por área, decisiones de §9 y mockup de los 3 flujos peores | Claude (chat) y Juan | Zoily completa M1, M8, A1 y M7 en el mockup, sola. |
| **E** | Implementación por área y nueva prueba con Zoily | Claude Code | Zoily completa sola los escenarios T1 del área implementada. |
| **BUG-HOG** | Corregir HZ-6 (en paralelo, no espera a las fases) | Claude Code | El total del hogar coincide con la suma manual de las cuentas que deberían consolidar. |

**Regla:** no se implementan cambios de UI de las áreas (Fase E) antes de que
la Fase D esté aprobada. La única excepción es BUG-HOG.

## 7. BUG-HOG — total del hogar en cero (HZ-6)

### Hechos verificados en el código (commit `95e5b9f`)

- **Visibilidad y consolidación son configuraciones distintas**
  (`REQUISITES.md` §I.5 y §M.3: *"La participación en la consolidación no
  implica acceso… La privacidad es independiente de la participación"*).
- `app/src/screens/AgregarElementoScreen.tsx` pregunta **solo por
  visibilidad** (¿el hogar ve que existe? ¿ve el saldo?) y **nunca envía
  `participaConsolidacion`**.
- `api/src/elemento/elemento.service.ts`:
  `participa_consolidacion: dto.participaConsolidacion ?? false`. Toda cuenta
  creada desde el asistente nace **sin sumar al hogar**, aunque se haya
  marcado como visible con saldo.
- `api/src/consolidacion/consolidacion.service.ts` (`#elementosConsolidados`)
  solo suma elementos `ACTIVO` con `participa_consolidacion = true`.
- `app/src/screens/DashboardScreen.tsx`: en la vista "Del hogar", las
  llamadas a `/metricas` y `/patrimonio-consolidado` están dentro de un
  `try/catch` que ante **cualquier error** deja ambos en `null` y el hero cae
  silenciosamente a `money(0, …)`. Si `total` es `null`, usa
  `metricas.porMoneda[0]`, que puede ser una moneda distinta a la del hogar.
- La única forma de activar la consolidación es desde
  `EditarElementoScreen` ("Cuenta en el patrimonio del hogar").

### Causas probables (en orden de prioridad)

1. **Consolidación nunca activada.** Las cuentas se marcaron como *visibles*
   pero no como *participantes*. Es el comportamiento esperado del código,
   así que el problema real es de diseño: el usuario entiende "compartir"
   como "sumar al hogar". Coincide con HZ-7 y H4.
2. **Error silenciado:** uno de los dos endpoints falla y el `catch` lo
   oculta mostrando 0.
3. **Moneda equivocada:** `total` es `null` (falta un tipo de cambio) y
   `porMoneda[0]` toma una moneda con saldo 0.

### Diagnóstico (Tarea 2, 2026-09-29) — causa 1 confirmada

Consulta de solo lectura en Neon, hogar "Flores Carrero" (`6d6be0e2-…`, CLP,
2 miembros ACTIVA):

- Las 7 cuentas del hogar son de Juan, todas CLP y ACTIVO, con
  `participa_consolidacion = false`. Seis tienen `VALOR=FAMILIAR` (el hogar ve
  el saldo) y Cuenta Rut solo `EXISTENCIA=FAMILIAR`. Suma manual:
  13.805.559 CLP. El total del hogar es 0 porque no hay nada que consolidar.
- Zoily no tiene ninguna cuenta (HZ-9). Las cuentas "compartidas" que vio
  eran las de Juan.
- Causa 3 descartada: todo está en CLP y hay tasas USD/EUR/CLF→CLP al día.
- Causa 2 descartada en la práctica: al activar "Cuenta en el patrimonio del
  hogar" desde la app (paso 2), el total del hogar muestra el monto, así que
  los endpoints responden bien.

### Pasos

1. **Confirmar la causa con datos reales.** Consultar en la base del entorno
   afectado `participa_consolidacion`, `estado` y `visibilidad` de las
   cuentas de Juan y Zoily, y llamar a
   `GET /hogares/:id/patrimonio-consolidado` con el token de Juan.
   *Señal:* una sola de las causas 1–3 explica la diferencia, con evidencia
   (filas de la base o el JSON de respuesta).
2. **Si la causa es la 1, no se corrige "a ciegas".** Es la decisión D-2 de
   §9: cómo se pregunta y cuál es el valor por defecto. Mientras se decide,
   la única acción permitida es activar la consolidación **desde la app**
   (Editar elemento) en las cuentas que Juan y Zoily quieran sumar. Nada de
   `UPDATE` manual en producción.
   *Señal:* el hero del hogar coincide con la suma manual.
3. **Independientemente de la causa**, reemplazar el `catch` silencioso por
   un mensaje de error visible y usar la moneda del hogar (no `porMoneda[0]`)
   como respaldo. Un total de 0 falso es peor que un error explícito.
   *Señal:* un test (unitario o e2e) cubre el caso "endpoint falla" y el
   caso "falta tipo de cambio"; el hero muestra el error en vez de 0.

**Rollback:** trabajar en la rama `fix/hogar-total-cero`; revertir con
`git revert` o descartar la rama. Cualquier cambio de datos en producción
requiere un respaldo previo (`pg_dump` de Neon) y va solo por comandos de la
app, para que quede auditado.

## 8. Formato de salida de la Fase B (para Claude Code)

Por cada escenario, recorrer las pantallas **desde el código real**
(`app/src/screens`, llamadas `nav.go()`, textos visibles en pantalla) como lo
haría un usuario nuevo, y registrar:

```markdown
### <ID> — <escenario>
**Ruta real:** Tab X → Pantalla A → Pantalla B → …
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
**Conteo:** pantallas: n · decisiones: n · campos obligatorios: n · términos de dominio expuestos: n
**¿Se puede completar?** Sí / Sí con conocimiento previo / No — por qué
**¿El dominio lo soporta?** Sí / Parcial / No — (resuelve los *(verificar)* de §5)
**Hallazgos relacionados:** HZ-…
```

Cierre de la Fase B: una tabla resumen con todos los escenarios, ordenados
primero por frecuencia (T1 antes que T2) y después de peor a mejor según el
conteo. De esa tabla salen los 3 flujos peores para el mockup de la Fase D.

## 9. Decisiones de la Fase D (cerradas)

Cerradas en el bloque 1 de la Fase D (2026-09-29). El detalle está en
[`DECISIONES_FASE_D_S01.md`](DECISIONES_FASE_D_S01.md) §1. **Ninguna está implementada:** se implementan en la Fase E,
en el orden de su §4.

- ✅ **D-1 — Ahorrar para una meta (HIP-4):** servicio `AhorrarParaObjetivo`,
  una transacción, N orígenes. [§1](DECISIONES_FASE_D_S01.md#1-decisiones-cerradas)
- ✅ **D-2 — Qué compartes con el hogar:** una pregunta con 4 niveles; por
  defecto "Que puedan transferirme". [§1](DECISIONES_FASE_D_S01.md#1-decisiones-cerradas)
- ✅ **D-3 — Plata de otra persona (HIP-2):** servicio
  `RegistrarPlataDeOtraPersona` (HZ-11, opción b), saldo único con signo.
  [§1](DECISIONES_FASE_D_S01.md#1-decisiones-cerradas)
- ✅ **D-4 — Palabras (HIP-3):** diccionario de superficie; "Meta" y
  "Ahorrar". [§1](DECISIONES_FASE_D_S01.md#1-decisiones-cerradas) y [§2](DECISIONES_FASE_D_S01.md#2-diccionario-de-superficie-d-4)
- ✅ **D-5 — Destino de otro miembro:** plantillas y programados siguen la regla
  de TRANSFERENCIA (G6); relaja G24 y G2. [§1](DECISIONES_FASE_D_S01.md#1-decisiones-cerradas)
- ✅ **D-6 — Recurrencia (HZ-16):** periodicidad, día y categoría; aviso
  "¿Se pagó?", sin registro automático. [§1](DECISIONES_FASE_D_S01.md#1-decisiones-cerradas)
- ✅ **D-7 — Solicitud de aporte (M7):** notificación con acción, tipo
  `SOLICITUD_APORTE`. [§1](DECISIONES_FASE_D_S01.md#1-decisiones-cerradas)
- ✅ **D-8 — Dos puertas y "¿de quién es?" (HZ-23):** el menú `+` tiene una
  puerta por dirección de la plata (Gasté · Recibí · Moví plata · …) y el
  paso 2 de Gasté y Recibí pregunta de quién es. Desaparecen "Gasto
  compartido" y "Plata de otra persona". Sin dominio nuevo (mismas
  orquestaciones de D-3 y D-7). Cerrada al terminar la Fase D (2026-10-02);
  riesgo aceptado: no probada con una usuaria sin contacto previo.
  [§4 de `CIERRE_FASE_D_S01.md`](CIERRE_FASE_D_S01.md#4-d-8-dos-puertas-y-de-quién-es-decisión-nueva)

M9/M7 (atribución del gasto por persona) queda **fuera de alcance**; condición
de reapertura en [`DECISIONES_FASE_D_S01.md`](DECISIONES_FASE_D_S01.md) §3.

## 10. Instrucciones de ejecución para Claude Code

### 10.1 Reglas (aplican a todas las tareas)

1. **No cambiar el dominio.** Los nombres de comandos se mantienen literales
   (BUILD_INSTRUCTIONS §4). Solo puede cambiar lo que ve el usuario (textos,
   orden, agrupación, valores por defecto), y solo desde la Fase E. Los
   hallazgos de tipo `DOMINIO` y las decisiones D-1 a D-5 (§9) **no se
   implementan**: se registran en `GAPS.md`.
2. **Ejecución por tareas validadas.** Cada tarea tiene objetivo, pasos y
   señal de validación. Si la señal aparece, sigues con la siguiente sin
   pedir confirmación. Si no aparece, entras en modo error.
3. **Modo error:** detienes todo el avance. Analizas lo esperado frente a lo
   obtenido y las causas probables en orden, aplicas **una sola** corrección
   concreta y repites solo ese paso hasta que pase. Si la corrección empeora
   algo, vuelves al último estado estable antes de intentar otra.
4. **Antes de modificar estado** (código, configuración, datos), dejas
   escrito cómo se revierte y cuál era el estado previo.
5. **Una rama por fase o por bug.** Commits pequeños y reversibles. Los
   documentos de registro pueden ir directo a `main`.
6. **Datos de producción:** prohibido el `UPDATE` o `DELETE` manual. Solo
   lectura, salvo por comandos de la app (quedan auditados), con un respaldo
   previo (`pg_dump` de Neon).
7. **Si falta contexto crítico, preguntas antes de actuar.** Nunca asumas
   sin decirlo.

### 10.2 Tareas, en orden

**Tarea 1 — Registrar este frente de trabajo** (directo a `main`)
- Mover este archivo a `Docs/usabilidad/USABILIDAD_REAL_S01.md` si no está ahí.
- `GAPS.md` Parte 1: agregar **G33 — Rediseño de usabilidad a partir de la
  prueba con usuaria real**, que apunte a este archivo, e incluir las
  decisiones abiertas D-1 a D-5 como sub-ítems `📋 DECISIÓN`. Actualizar
  G32: la validación con persona nueva está hecha y su resultado fue negativo
  (se continúa en G33).
- `Docs/README.md`: agregar la carpeta `usabilidad/` y este archivo al índice.
- `README.md` raíz: corregir la sección Pendiente (G32 ya no "falta aplicar
  los ajustes"; ahora el pendiente es G33).
- *Señal:* un commit en `main` con los cuatro archivos y `git diff` sin
  cambios de código.

**Tarea 2 — Diagnóstico de BUG-HOG** (solo lectura)
- Ejecutar el paso 1 de §7: consultar `participa_consolidacion`, `estado` y
  visibilidad de las cuentas de ambos usuarios en el entorno afectado, y
  llamar a `GET /hogares/:id/patrimonio-consolidado`.
- **No modificar datos.**
- *Señal:* un reporte que identifica cuál de las causas 1–3 explica el total
  en cero, con evidencia (filas o JSON). Si es la causa 1, se detiene aquí lo
  que toca a datos y se avisa a Juan (paso 2 de §7 es suyo).

**Tarea 3 — Corrección defensiva de BUG-HOG** (rama `fix/hogar-total-cero`)
- Ejecutar el paso 3 de §7: eliminar el `catch` silencioso del Inicio en la
  vista "Del hogar", mostrar el error y usar la moneda del hogar como
  respaldo en lugar de `porMoneda[0]`.
- *Rollback:* descartar la rama o `git revert`.
- *Señal:* tests nuevos para "endpoint falla" y "falta tipo de cambio" en
  verde; lint, build y e2e existentes en verde.

**Tarea 4 — Fase B: recorrido de escenarios** (solo lectura, sin tocar código)
- Recorrer los 29 escenarios T1 y T2 de §5 en `app/src/screens` con el
  formato exacto de §8. Para los T3, solo verificar que exista un camino.
- Resolver cada *(verificar)* de §5 en el campo "¿El dominio lo soporta?".
- Salida: `Docs/usabilidad/RECORRIDO_ESCENARIOS_S01.md`, con la tabla
  resumen de cierre ordenada por frecuencia y después por severidad.
- *Señal:* el archivo cubre los 29 escenarios, cada uno con conteo y
  veredicto, y la tabla resumen marca los 3 flujos peores.

**Fin del alcance de Claude Code en esta sesión.** No avanzar a las Fases C,
D ni E: dependen de un trabajo posterior en el chat y de decisiones de Juan.

## 11. Pendientes y compromisos

- [x] **Juan:** catálogo validado (2026-09-29). Fase A cerrada.
- [x] **Claude Code:** Tareas 1 a 3 de §10.2 (2026-09-29).
- [x] **Claude Code:** Tarea 4 de §10.2 (Fase B, 2026-09-29). Nota: el catálogo
      tiene 28 escenarios T1/T2, no 29.
- [x] **Juan:** activar en la app "Cuenta en el patrimonio del hogar" en las
      cuentas que deban sumar (§7, paso 2).
- [x] **Juan:** llevar `RECORRIDO_ESCENARIOS_S01.md` al chat para iniciar la
      Fase C.
- [x] **Claude (chat):** Fase C con el resultado de B (`BENCHMARK_S01.md`,
      2026-09-29). Juan aceptó la opción (b) de HZ-11 y el resto de su §5.
- [x] **Claude Code:** Tarea 5 de `BENCHMARK_S01.md` §8 (registro de la Fase C).
- [x] **Claude Code:** corregir HZ-14 en la rama `fix/valoriza-advertencia`
      (solo el texto del asistente; commit `9b0a1d8`, `tsc` en verde).
- [x] **Juan:** revisar `fix/valoriza-advertencia`; mergeada a `main`
      (2026-09-29). *Rollback:* `git revert -m 1` del merge.
- [x] **Claude (chat) y Juan:** Fase D, bloque 1 (decisiones D-1 a D-7,
      `DECISIONES_FASE_D_S01.md`, 2026-09-29).
- [x] **Claude Code:** Tarea 6 de `DECISIONES_FASE_D_S01.md` §6 (registro del bloque 1).
- [x] **Claude (chat):** Fase D, bloque 2 (prototipo interactivo v5,
      `prototipo/prototipo-fase-d-s01.html`, 2026-10-02).
- [x] **Zoily:** completar M1, M8, A1 y M7 sola en el prototipo (señal del
      bloque 2). Cumplida: 6 de 6 (pruebas 4 y 6 en el 2º intento).
- [x] **Juan:** D-8 aprobada, con el riesgo aceptado de
      [`CIERRE_FASE_D_S01.md`](CIERRE_FASE_D_S01.md) §4.5 (2026-10-02).
- [x] **Claude Code:** Tarea 7 de `CIERRE_FASE_D_S01.md` §6 (registro del cierre
      de la Fase D).
- [ ] **Fase E**, en este orden ([`CIERRE_FASE_D_S01.md`](CIERRE_FASE_D_S01.md) §5):
  1. ✅ D-4 (diccionario) + HZ-19 (numeración) + HZ-22 (regla del paso 2).
     Rama `feat/G33-E1-palabras-y-pasos`, probada por Juan en el teléfono
     (tema oscuro y claro) y mergeada (2026-10-03). HZ-22 se aplicó solo a
     Ajuste y Nueva meta: el Tipo de Registrar movimiento y Programados pasa
     a ser la puerta del menú con D-8 (bloque 6). Residuo: errores del backend
     sin código (lista en `GAPS.md`, G33), para los bloques 5 o 6.
  2. HZ-3 + HZ-17: listas de selección (más de 6 opciones en `Select`, hoja
     modal) y "Desde qué cuenta" / "A qué cuenta" agrupadas por tipo, sin
     listas repetidas.
  3. HZ-13: gastar desde la meta (A5).
  4. C1 + D-2: alta de cuenta y compartir con el hogar.
  5. D-1: Ahorrar (A1/A2).
  6. D-8 + D-3 (incluye HZ-11) + HZ-18 + HZ-20: el paso 2 "¿de quién es?" en
     Gasté y Recibí, plata de otra persona, libre para gastar sin plata ajena
     y recuperación.
  7. D-7 + HZ-21: solicitud de aporte, "De alguien del hogar" en Recibí y
     "Entre [miembro] y tú".
  8. D-5 + D-6: recurrencia y destino de otro miembro.
- [ ] **Zoily:** señal de la Fase E: usar la app real durante un mes y
      completar sola los mismos seis escenarios.
