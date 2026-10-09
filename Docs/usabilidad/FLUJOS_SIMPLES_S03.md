# Flujos simples — Sesión 03 (después de G35)

**Objetivo de este archivo:** recorrer, sobre la app ya rediseñada (G35), cada
escenario del catálogo de `USABILIDAD_REAL_S01.md` §5, contar cuánto cuesta
completarlo y, escenario por escenario, definir el flujo objetivo: registrar y
accionar cosas con la menor cantidad de pasos posible, con cada paso claro.
Es la fuente de verdad de este frente (G39 en `GAPS.md`).

- **Ubicación en el repo:** `Docs/usabilidad/FLUJOS_SIMPLES_S03.md`
- **Fecha:** 2026-10-09 · **Línea base:** `main` en `a5a38fb` (G35 completo,
  más G36–G38).
- **Antecedentes:** `RECORRIDO_ESCENARIOS_S01.md` (la misma medición, antes de
  la Fase E de G33 y de G35) y `MEJORA_VISUAL_S02.md` (inventario de las 60
  pantallas y sus acciones).

---

## 1. Por qué (Juan, 2026-10-09)

G35 cambió casi todo lo visual, pero **no los flujos** (§1 de
`MEJORA_VISUAL_S02.md`: "no cambian … qué pasos tiene cada formulario, a dónde
lleva cada botón"). Falta probar la facilidad de cada acción de punta a punta
y bajar los pasos. Puede terminar siendo otro rediseño, más fino, sobre lo ya
trabajado.

## 2. Alcance y reglas

- **Entra la estructura de los flujos** (S3-2): qué viene elegido por
  defecto, el orden de las preguntas, qué se pregunta y qué se deduce, desde
  dónde se entra, atajos, y cuántas pantallas u hojas se atraviesan.
- **No entra lo visual** (ya decidido en G35): se reutilizan las piezas
  comunes (`MontoBanda`, `Elegir`, `Pastilla`, `Opcionales`, `Cuando`…).
- **Dominio y backend:** solo si un flujo objetivo lo exige; se anota como
  decisión de Juan antes de tocarlo.
- **Muestra completa** (S3-1): se trabajan los 33 escenarios (T1, T2 y T3).
  No se agregan ni se quitan escenarios sin la aprobación de Juan (§5 de S01).
- **Meta** (S3-3): un T1 en **≤ 4 toques + el monto**; un T2 en **≤ 8**.
- **Pasos claros** (S3-5, Juan): bajar toques nunca se logra escondiendo un
  paso.
  1. Lo que viene elegido se ve en su lugar, como un paso ya hecho (HZ-24),
     y se cambia ahí mismo con un toque.
  2. El resumen del pie dice qué se va a anotar con todo lo elegido ("Salen
     10.000 de CuentaRUT"), para que nada pase sin verse.
  3. Cada pregunta dice una sola cosa; el siguiente paso pendiente es el
     único resaltado.
  4. En este documento cada flujo (actual y objetivo) se escribe como tabla
     paso a paso: dónde está el usuario, qué ve, qué hace y cuántos toques.
- **Método por escenario:** (1) recorrido actual con conteo (§5, hecho);
  (2) Claude propone el flujo objetivo; (3) Juan decide; (4) se implementa en
  una rama; (5) se valida con capturas y en el teléfono, con el conteo nuevo;
  (6) se anota en el escenario. Los primeros escenarios definen los patrones
  (§6) que después se aplican a los demás.
- **Criterio:** `USABILIDAD_REAL_S01.md` §2 (lo frecuente rápido y a la
  vista; lo raro no compite con lo frecuente) y la claridad por sobre lo
  validado.

## 3. Cómo se cuenta

- **Toques:** cada toque del usuario, desde la pestaña donde está. Elegir de
  una lista (`Elegir`) cuenta **2** (abrir la hoja + elegir). Una fecha que
  no es Hoy ni Ayer cuenta **3** (Otra fecha + día + listo). Una pregunta con
  valor por defecto que no hay que cambiar cuenta 0.
- **Campos:** lo que hay que escribir con el teclado (monto, nombre, motivo).
- **Pantallas:** pantallas distintas atravesadas, incluida la de partida. Las
  hojas modales no cuentan como pantalla.
- **Mínimo:** el camino más corto (con Frecuente, cuenta preelegida u otro
  atajo), cuando existe.
- Los conteos salen de leer el código (`app/src/screens`, `hooks/useAnotar`),
  no del cronómetro. Se confirman con capturas al trabajar cada escenario.
  Lo marcado *(verificar)* no se pudo confirmar leyendo.

## 4. Catálogo (33 escenarios)

Copia limpia de `USABILIDAD_REAL_S01.md` §5. Frecuencia: T1 = semanal o
mensual · T2 = ocasional · T3 = raro o avanzado.

| # | ID | Escenario (palabras del usuario) | Frec. |
|---|----|----------------------------------|-------|
| 1 | M1 | Gasté 10.000 en un helado el 18-sep con mi CuentaRUT | T1 |
| 2 | M2 | Me llegó el sueldo a la cuenta corriente | T1 |
| 3 | M3 | Paso plata de mi cuenta corriente a mi CuentaRUT | T1 |
| 4 | M4 | Le transfiero a mi pareja para que pague Netflix | T1 |
| 5 | M5 | Pago cuentas fijas (luz, Spotify) todos los meses | T1 |
| 6 | M6 | Compro con la tarjeta de crédito y después pago la tarjeta | T1 |
| 7 | M7 | Compro algo para la casa y mi pareja me pasa su parte | T1 |
| 8 | M8 | Noira me transfiere 30.000 para que le compre un labial y se lo compro | T2 |
| 9 | M9 | Juan me pasa 100.000 para mi papá; se los envío y agrego 100.000 míos | T2 |
| 10 | M10 | Le compro algo a mis papás y me devuelven (mismo mes u otro) | T2 |
| 11 | M11 | Pagué algo en dólares / cambié plata | T3 |
| 12 | M12 | Me equivoqué en un monto y lo corrijo | T2 |
| 13 | M13 | Registré algo que no pasó y lo borro | T2 |
| 14 | A1 | Transfiero plata de mi cuenta a Fintual, a mi meta Hogar | T1 |
| 15 | A2 | Fin de mes: junto lo que sobra de dos cuentas y lo mando a la meta | T1 |
| 16 | A3 | ¿Cuánto llevo para la meta y cuánto me queda libre para gastar? | T1 |
| 17 | A4 | Mi Fintual rentó; actualizo cuánto vale | T1 |
| 18 | A5 | Uso la plata de la meta (compro el pasaje de las vacaciones) | T2 |
| 19 | A6 | Separo plata para algo sin moverla de mi cuenta (fondo virtual) | T2 |
| 20 | A7 | Creamos una meta del hogar y aportamos los dos | T2 |
| 21 | A8 | Cumplí la meta / la quiero reabrir | T3 |
| 22 | H1 | ¿Cuánta plata tenemos como hogar? | T1 |
| 23 | H2 | ¿Cuánto gastamos este mes, yo y el hogar? | T1 |
| 24 | H3 | Juan programa una transferencia mensual a la Falabella de Zoily | T1 |
| 25 | H4 | Decido qué ve mi pareja de mis cuentas y qué suma al hogar | T2 |
| 26 | H5 | Tenemos una deuda juntos (hipotecario o auto) y la pagamos | T2 |
| 27 | H6 | Invito a mi pareja / acepto la invitación | T3 |
| 28 | C1 | Agrego mi cuenta Falabella con su saldo actual | T2 |
| 29 | C2 | Agrego mi tarjeta de crédito con lo que debo | T2 |
| 30 | C3 | Agrego el auto o la casa y actualizo su valor una vez al año | T3 |
| 31 | C4 | Cerré una cuenta | T3 |
| 32 | P1 | Me pongo un presupuesto del mes y veo si me pasé | T2 |
| 33 | P2 | Dejo anotado un pago futuro (arriendo, dividendo) | T2 |

## 5. Recorrido en el diseño actual

**Entradas comunes.**
- **Hoja "+"** (Inicio y Movimientos): 💸 Gasté · 💰 Recibí · 🔁 Moví plata
  (tarjetas grandes) · 🐷 Ahorrar para una meta · 💳 Pagar tarjeta (si hay
  tarjetas) · ➕ Agregar cuenta. Abrir la hoja y elegir: 2 toques.
- **Atajos del Inicio:** Anotar (abre la hoja "+") · Metas · Programados ·
  Tu plata.

**Anatomía de Gasté / Recibí / Moví plata** (`RegistrarMovimientoScreen`, se
usa en 15 escenarios). Una pantalla, en este orden:

| Orden | Pregunta | Por defecto | Obligatoria |
|-------|----------|-------------|-------------|
| 1 | Monto (banda con "⚡ Tus frecuentes": 2 a la vista y "🔍 Ver los N") | vacío | Sí |
| 2 | "¿De quién es?" (solo Gasté y Recibí, si hay hogar u otras personas) | 🙋 Mío | Sí |
| 3 | Cuenta: "¿Desde qué cuenta pagaste?" / "¿A qué cuenta llegó?" (Moví plata: las dos) | **vacía** | Sí |
| 4 | "¿Sale de una meta?" (solo si la cuenta tiene plata en metas) | no | No |
| 5 | "¿De qué categoría?" (lista en hoja) | vacía | No |
| 6 | Fecha: Hoy · Ayer · Otra fecha | Hoy | Sí |
| 7 | Opcionales: 📝 Detalle · 🔁 Se repite · 🏷️ Etiquetas | — | No |
| 8 | Pie: resumen + "Anotar …" | — | — |

La cuenta solo viene elegida si se entra desde el detalle de una cuenta, un
Frecuente, la Meta o el Hogar; desde la hoja "+", nunca.

**Formato de cada escenario:** tabla de pasos (dónde está · qué hace ·
toques), conteo (pantallas · toques · campos), lo que todavía cuesta y el
flujo objetivo (tabla con el mismo formato cuando hay propuesta).

### 5.1 Movimientos — el día a día

#### M1 — Gasté 10.000 en un helado el 18-sep con mi CuentaRUT

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 💸 Gasté | 1 |
| 3 | Gasté | Escribe 10.000 | campo |
| 4 | Gasté | "¿Desde qué cuenta pagaste?" → CuentaRUT | 2 |
| 5 | Gasté | "¿De qué categoría?" → Comida (opcional) | 2 |
| 6 | Gasté | Fecha: Otra fecha → 18-sep | 3 |
| 7 | Gasté | "Anotar gasto" | 1 |

**Conteo:** 2 pantallas · 10 toques · 1 campo. Si es de hoy: 7. Con un
Frecuente: 4.
**Lo que cuesta:** la cuenta no viene elegida aunque casi siempre sea la
misma; la categoría es otra hoja; "Desde" lista todos los elementos (también
deudas e inmuebles, resto de HZ-17).

**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — patrones F-1 y F-2 (§6).

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💸 Gasté | 1 |
| 3 | Gasté | Banda del monto resaltada (paso actual) | Escribe 10.000 | campo |
| 4 | Gasté | "¿En qué?" con 4 chips: sus categorías de gasto más usadas (🍦 Comida, 🛒 Mercado, 🚌 Transporte, 💡 Cuentas) y "🔍 Otra" | Toca 🍦 Comida | 1 |
| 5 | Gasté | "¿Desde qué cuenta pagaste?" **ya dice 🏦 CuentaRUT** (la de su último gasto), marcado como hecho, con "Cambiar" | Nada (o 2 si es otra) | 0 |
| 6 | Gasté | Fecha en Hoy | Otra fecha → 18-sep | 3 |
| 7 | Gasté | Pie: "💸 Salen 10.000 de CuentaRUT · Comida · 18 sep" | "Anotar gasto" | 1 |

**Conteo objetivo:** 2 pantallas · **4 toques + monto** si es de hoy (meta ✅);
7 con la fecha del 18-sep (la fecha pasada no se puede deducir). Antes: 7 y 10.

#### M2 — Me llegó el sueldo a la cuenta corriente

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 💰 Recibí | 1 |
| 3 | Recibí | Escribe el monto | campo |
| 4 | Recibí | "¿A qué cuenta llegó?" → Cuenta corriente | 2 |
| 5 | Recibí | Categoría → Sueldo (opcional) | 2 |
| 6 | Recibí | "Anotar ingreso" | 1 |

**Conteo:** 2 pantallas · 7 toques · 1 campo. Con el Frecuente "Sueldo":
4 toques, 0 campos.
**Lo que cuesta:** lo mismo que M1; además, algo que llega todos los meses
por el mismo monto se anota a mano (lo resuelve M5 con "Se repite").

**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-1 y F-2.

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💰 Recibí | 1 |
| 3 | Recibí | Banda del monto resaltada | Escribe el monto | campo |
| 4 | Recibí | "¿De qué?" con chips de sus categorías de ingreso (💼 Sueldo, …) y "🔍 Otra" | Toca 💼 Sueldo | 1 |
| 5 | Recibí | "¿A qué cuenta llegó?" **ya dice 🏦 Cuenta corriente** (la de su último ingreso) | Nada | 0 |
| 6 | Recibí | Pie: "💰 Entran X a Cuenta corriente · Sueldo · hoy" | "Anotar ingreso" | 1 |

**Conteo objetivo:** 2 pantallas · **4 toques + monto** (meta ✅). Antes: 7.

#### M3 — Paso plata de mi cuenta corriente a mi CuentaRUT

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 🔁 Moví plata | 1 |
| 3 | Moví plata | Escribe el monto | campo |
| 4 | Moví plata | "¿Desde qué cuenta?" → Cuenta corriente | 2 |
| 5 | Moví plata | "¿A qué cuenta?" → CuentaRUT | 2 |
| 6 | Moví plata | "Anotar movimiento" | 1 |

**Conteo:** 2 pantallas · 7 toques · 1 campo.
**Lo que cuesta:** dos hojas con casi la misma lista. (Si las monedas son
distintas, pasa solo a cambio de moneda: bien resuelto.)

**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-1 aplicado al par de cuentas.

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 🔁 Moví plata | 1 |
| 3 | Moví plata | Banda del monto resaltada | Escribe el monto | campo |
| 4 | Moví plata | "¿Desde qué cuenta?" **ya dice Cuenta corriente** y "¿A qué cuenta?" **ya dice CuentaRUT** (el par de su último movimiento), con "Cambiar" en cada uno | Nada (2 por cada una que cambie) | 0 |
| 5 | Moví plata | Pie: "🔁 Pasas X de Cuenta corriente a CuentaRUT. No cuenta como gasto." | "Anotar movimiento" | 1 |

**Conteo objetivo:** 2 pantallas · **3 toques + monto** (meta ✅). Antes: 7.

#### M4 — Le transfiero a mi pareja para que pague Netflix

**Actual (ruta más corta, desde Hogar)**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Hogar | 1 |
| 2 | Hogar | En "🔁 Para transferirles", toca la cuenta de la pareja | 1 |
| 3 | Moví plata (destino elegido) | Escribe el monto | campo |
| 4 | Moví plata | "¿Desde qué cuenta?" | 2 |
| 5 | Moví plata | "Anotar movimiento" | 1 |

**Otra ruta:** "+" → Moví plata → la cuenta de la pareja en "¿A qué cuenta?"
(bajo 👥): 7 toques, como M3.
**Conteo:** 3 pantallas · 5 toques · 1 campo.
**Lo que cuesta:** la cuenta de la pareja solo aparece si la pareja la dejó
visible (HZ-10; desde D-8 existe "Que [pareja] pueda transferirme aquí", pero
lo hace la otra persona). Desde el "+" no se intuye que la pareja está en la
lista de destino.
**Objetivo:** *por definir.*

#### M5 — Pago cuentas fijas (luz, Spotify) todos los meses

**Actual — la primera vez** (ya con la cuenta recordada y las categorías en
botones de M1–M3)

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 💸 Gasté | 1 |
| 3 | Gasté | Escribe el monto | campo |
| 4 | Gasté | "¿En qué?" → 💡 Luz (botón) | 1 |
| 5 | Gasté | Cuenta: viene la de la última vez | 0 |
| 6 | Gasté | 🔁 Se repite → abre "¿Se repite?" → Cada mes | 3 |
| 7 | Gasté | "Anotar gasto" | 1 |

**Actual — cada mes** (corregido al revisar el código: "Sí, se pagó" ya
confirma sin pasar por otra pantalla)

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca la campana | 1 |
| 2 | Notificaciones | Toca el aviso "¿Se pagó?" | 1 |
| 3 | Programado | "✅ Sí, se pagó" (anota con el monto y la fecha previstos) | 1 |

**Conteo:** primera vez 2 pantallas · 7 toques · 1 campo; cada mes 3
pantallas · 3 toques.
**Lo que cuesta:** lo que hay que confirmar vive en la campana, que se ve
como un número, no como una pregunta; "Se repite" abre una lista para elegir
entre dos opciones.

**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-3 y F-8 (§6).

*La primera vez*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💸 Gasté | 1 |
| 3 | Gasté | Banda del monto resaltada | Escribe 32.000 | campo |
| 4 | Gasté | "¿En qué?" con botones | Toca 💡 Luz | 1 |
| 5 | Gasté | La cuenta de la última vez, ya elegida | Nada | 0 |
| 6 | Gasté | 🔁 Se repite: al tocarlo aparecen dos botones, **🔁 Cada mes · 📆 Cada año** (sin lista) | Toca 🔁 Se repite y 🔁 Cada mes | 2 |
| 7 | Gasté | Pie: "💸 Salen 32.000 de Cuenta corriente · Luz · hoy. Te avisamos cada mes, el día 9." | "Anotar gasto" | 1 |

*Cada mes*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | Arriba, en los avisos: "⏰ ¿Pagaste Luz?" y debajo "32.000 CLP · era el 9 nov", con el botón **✅ Sí** | Toca ✅ Sí | 1 |
| 2 | Inicio | "Listo, quedó anotado"; el aviso desaparece | — | 0 |

Si fue otro monto o este mes no se paga, toca la fila (no el botón) y llega al
Programado de siempre ("✏️ Fue otro monto", "⏭️ Este mes no").

**Conteo objetivo:** primera vez 2 pantallas · **6 toques + monto** (se hace
una vez); cada mes 1 pantalla · **1 toque** (meta ✅). Antes: 7 y 3.

#### M6 — Compro con la tarjeta de crédito y después pago la tarjeta

**Actual — la compra:** igual que M1, eligiendo la tarjeta en "¿Desde qué
cuenta pagaste?" (7 toques si es de hoy, 1 campo).

**Actual — el pago**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 💳 Pagar tarjeta (si hay una sola tarjeta, viene elegida; si no, +2) | 1 |
| 3 | Pagar tarjeta | Escribe el monto | campo |
| 4 | Pagar tarjeta | "¿Desde qué cuenta?" | 2 |
| 5 | Pagar tarjeta | "Pagar tarjeta" | 1 |

**Conteo:** compra 2 pantallas · 7 toques · 1 campo; pago 2 pantallas ·
5 toques · 1 campo.
**Lo que cuesta:** no se sugiere el monto a pagar (lo que debes hoy); nada en
Gasté indica que la tarjeta se elige como cuenta.
**Objetivo:** *por definir.*

#### M7 — Compro algo para la casa y mi pareja me pasa su parte

**Actual — quien pagó**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 💸 Gasté | 1 |
| 3 | Gasté | Escribe el monto | campo |
| 4 | Gasté | "¿De quién es este gasto?" → 👫 Compartido con [pareja] | 2 |
| 5 | Gasté | "¿Cuánto le toca?" (viene La mitad) | 0 |
| 6 | Gasté | "¿Desde qué cuenta pagaste?" | 2 |
| 7 | Gasté | "¿A qué cuenta te transfiere?" (viene la del gasto) | 0 |
| 8 | Gasté | Categoría | 2 |
| 9 | Gasté | "Anotar gasto" | 1 |

**Actual — la pareja**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca la alerta "por pagar" | 1 |
| 2 | Pagar | Elige su cuenta (solo si tiene más de una) | 0 o 2 |
| 3 | Pagar | "✅ Transferir" | 1 |

**Conteo:** quien pagó 2 pantallas · 9 toques · 1 campo; la pareja 2
pantallas · 2 a 4 toques.
**Lo que cuesta:** poco. Era "No se completa" en S01; hoy resuelto (D-7).
**Objetivo:** *por definir.*

#### M8 — Noira me transfiere 30.000 para que le compre un labial y se lo compro

**Actual — llega la plata**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 💰 Recibí | 1 |
| 3 | Recibí | Escribe 30.000 | campo |
| 4 | Recibí | "¿De quién es esta plata?" → 👤 De otra persona | 2 |
| 5 | Recibí | "¿Quién?" → ➕ Nueva persona | 2 |
| 6 | Recibí | Escribe "Noira" | campo |
| 7 | Recibí | "¿A qué cuenta llegó?" | 2 |
| 8 | Recibí | "Anotar plata de otra persona" | 1 |

**Actual — la compra**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 💸 Gasté | 1 |
| 3 | Gasté | Escribe 30.000 | campo |
| 4 | Gasté | "¿De quién es este gasto?" → De otra persona | 2 |
| 5 | Gasté | "¿Quién?" → Noira | 2 |
| 6 | Gasté | "¿Desde qué cuenta pagaste?" | 2 |
| 7 | Gasté | "Anotar plata de otra persona" | 1 |

**Conteo:** 4 pantallas · 18 toques · 3 campos.
**Lo que cuesta:** dos preguntas seguidas ("De otra persona" y "¿Quién?")
para un solo dato; la segunda vez Noira ya existe y podría ofrecerse directo.
Dominio resuelto (D-3: no infla ingresos ni gastos).
**Objetivo:** *por definir.*

#### M9 — Juan me pasa 100.000 para mi papá; se los envío y agrego 100.000 míos

**Actual — Juan:** como M4, hacia la cuenta de Zoily (5 toques, 1 campo).

**Actual — Zoily**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 💸 Gasté | 1 |
| 3 | Gasté | Escribe 200.000 (Mío) | campo |
| 4 | Gasté | "¿Desde qué cuenta pagaste?" | 2 |
| 5 | Gasté | Categoría | 2 |
| 6 | Gasté | "Anotar gasto" | 1 |

(En Recibí, "👥 De alguien del hogar" muestra lo que le llegó de Juan y no
anota nada, D-8.)
**Conteo:** 4 pantallas (2 por persona) · 12 toques · 2 campos.
**Lo que cuesta:** los 100.000 "de paso" quedan como gasto de Zoily; "De otra
persona" no acepta a un miembro del hogar *(verificar si hay otra vía)*
(HIP-2).
**Objetivo:** *por definir.*

#### M10 — Le compro algo a mis papás y me devuelven

**Actual — la compra**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 💸 Gasté | 1 |
| 3 | Gasté | Escribe el monto | campo |
| 4 | Gasté | "¿De quién es este gasto?" → De otra persona | 2 |
| 5 | Gasté | "¿Quién?" → ➕ Nueva persona | 2 |
| 6 | Gasté | Escribe "Papás" | campo |
| 7 | Gasté | "¿Papás te había pasado plata antes?" → No, me la va a devolver | 2 |
| 8 | Gasté | "¿Desde qué cuenta pagaste?" | 2 |
| 9 | Gasté | "Anotar plata de otra persona" | 1 |

**Actual — la devolución**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 💰 Recibí | 1 |
| 3 | Recibí | Escribe el monto | campo |
| 4 | Recibí | De otra persona | 2 |
| 5 | Recibí | "¿Quién?" → Papás | 2 |
| 6 | Recibí | "¿A qué cuenta llegó?" | 2 |
| 7 | Recibí | "Anotar plata de otra persona" | 1 |

(Otra vía para la devolución: el detalle de lo que te deben → "🤝 Me
pagaron".)
**Conteo:** 4 pantallas · 20 toques · 3 campos.
**Lo que cuesta:** "plata de otra persona" para algo que pagué yo; la
pregunta del saldo previo es la más difícil de entender del flujo.
**Objetivo:** *por definir.*

#### M11 — Pagué algo en dólares / cambié plata

**Actual — cambiar plata**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 🔁 Moví plata | 1 |
| 3 | Moví plata | Escribe el monto | campo |
| 4 | Moví plata | "¿Desde qué cuenta?" → cuenta en CLP | 2 |
| 5 | Moví plata | "¿A qué cuenta?" → cuenta en USD (pasa solo a cambio de moneda) | 2 |
| 6 | Moví plata | "Anotar cambio de moneda" | 1 |

**Pagar en dólares:** Gasté desde una cuenta en USD, como M1.
**Conteo:** 2 pantallas · 7 toques · 1 campo.
**Lo que cuesta:** necesita una tasa vigente en Ajustes › Tipos de cambio
*(verificar qué pasa si no hay)*: la tasa vive lejos del formulario.
**Objetivo:** *por definir.*

#### M12 — Me equivoqué en un monto y lo corrijo

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Movimientos | 1 |
| 2 | Movimientos | Toca el movimiento | 1 |
| 3 | Movimiento | ✏️ Editar | 1 |
| 4 | Editar movimiento | Escribe el monto correcto | campo |
| 5 | Editar movimiento | Escribe el motivo (mínimo 3 letras) | campo |
| 6 | Editar movimiento | Guardar | 1 |

**Conteo:** 3 pantallas · 4 toques · 2 campos.
**Lo que cuesta:** el motivo obligatorio para un error de tipeo; la cuenta y
el tipo no se cambian (hay que eliminar y anotar de nuevo).
**Objetivo:** *por definir.*

#### M13 — Registré algo que no pasó y lo borro

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Movimientos | 1 |
| 2 | Movimientos | Toca el movimiento | 1 |
| 3 | Movimiento | 🗑️ Eliminar movimiento | 1 |
| 4 | Confirmar | Escribe el motivo | campo |
| 5 | Confirmar | Eliminar | 1 |

**Conteo:** 3 pantallas · 4 toques · 1 campo.
**Lo que cuesta:** el motivo obligatorio.
**Objetivo:** *por definir.*

### 5.2 Metas y ahorro

#### A1 — Transfiero plata de mi cuenta a Fintual, a mi meta Hogar

**Actual** (mueve la plata y la guarda en la meta en un solo paso, D-1)

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 🐷 Ahorrar para una meta | 1 |
| 3 | Ahorrar | "¿Para qué meta?" → Hogar | 2 |
| 4 | Ahorrar | "¿En qué cuenta guardas la plata de esta meta?" → Fintual (0 si la meta ya tiene cuenta) | 0 o 2 |
| 5 | Ahorrar | "¿De dónde sale la plata?" → Falabella | 2 |
| 6 | Ahorrar | "¿Cuánto?" (o "💯 Todo lo libre", 1 toque) | campo |
| 7 | Ahorrar | Guardar ("🔁 Se mueven X de Falabella a Fintual") | 1 |

**Conteo:** 2 pantallas · 7 a 9 toques · 1 campo. Desde la Meta o su
tarjeta "🐷 Ahorrar", la meta viene elegida (−2).
**Lo que cuesta:** era "No se completa" en S01; hoy resuelto. Queda el orden:
se pregunta la meta antes que la plata.
**Objetivo:** *por definir.*

#### A2 — Fin de mes: junto lo que sobra de dos cuentas y lo mando a la meta

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1–4 | Inicio → Ahorrar | Como A1 pasos 1 a 4 | 4 a 6 |
| 5 | Ahorrar | "¿De dónde sale la plata?" → cuenta 1 | 2 |
| 6 | Ahorrar | "💯 Todo lo libre" | 1 |
| 7 | Ahorrar | "➕ Sumar otra cuenta" | 1 |
| 8 | Ahorrar | "¿De qué otra cuenta?" → cuenta 2 | 2 |
| 9 | Ahorrar | "💯 Todo lo libre" | 1 |
| 10 | Ahorrar | Guardar | 1 |

**Conteo:** 2 pantallas · 12 a 14 toques · 0 campos.
**Lo que cuesta:** hay que saber qué cuentas tienen sobrante; la app no
sugiere "te sobraron X este mes".
**Objetivo:** *por definir.*

#### A3 — ¿Cuánto llevo para la meta y cuánto me queda libre?

**Actual**

| # | Dónde | Qué ve | Toques |
|---|-------|--------|--------|
| 1 | Inicio | Bajo el total: 🐷 Guardado para metas y ✅ Puedes gastar; en "Tus metas", el avance de cada una | 0 |
| 2 | Meta (opcional) | Toca una meta para ver el detalle | 1 |

**Conteo:** 1 pantalla · 0 toques.
**Lo que cuesta:** nada relevante.
**Objetivo:** *por definir (probablemente se mantiene).*

#### A4 — Mi Fintual rentó; actualizo cuánto vale

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | En "Tus cuentas", toca Fintual | 1 |
| 2 | Detalle | 📈 Actualizar cuánto vale | 1 |
| 3 | Actualizar cuánto vale | Escribe el valor nuevo | campo |
| 4 | Actualizar cuánto vale | "📈 Guardar valor" | 1 |

**Conteo:** 3 pantallas · 3 toques · 1 campo.
**Lo que cuesta:** solo aparece si la cuenta tiene "cambia de valor"; si no,
hay que ir por 🔧 Corregir el saldo ("¿Cuánto tiene de verdad?" + por qué).
**Objetivo:** *por definir.*

#### A5 — Uso la plata de la meta (compro el pasaje)

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | En "Tus metas", toca la meta | 1 |
| 2 | Meta | 💸 Usar plata de la meta | 1 |
| 3 | Gasté (meta y cuenta elegidas, si hay una cuenta) | Escribe el monto | campo |
| 4 | Gasté | Categoría | 2 |
| 5 | Gasté | "Anotar gasto" | 1 |

**Otra ruta:** "+" → Gasté → cuenta → "¿Sale de una meta?" (+2 sobre M1).
**Conteo:** 3 pantallas · 5 toques · 1 campo. Era "No se completa" en S01
(HZ-13); hoy resuelto.
**Objetivo:** *por definir.*

#### A6 — Separo plata para algo sin moverla de mi cuenta

Se resuelve como una meta cuya plata queda en la misma cuenta de donde sale.

**Actual — crear la meta**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Planificar | 1 |
| 2 | Planificar | Toca "➕" (Nueva meta) | 1 |
| 3 | Nueva meta | "¿Para qué juntas?" | campo |
| 4 | Nueva meta | "¿La comparten en el hogar?" (viene No) y moneda (viene CLP) | 0 |
| 5 | Nueva meta | "¿Cuánto quieres juntar?" | campo |
| 6 | Nueva meta | Guardar | 1 |

**Actual — separar la plata:** como A1, eligiendo la misma cuenta en "¿En qué
cuenta guardas…?" y en "¿De dónde sale?" (no se mueve nada).
**Conteo:** ≈ 4 pantallas · 13 toques · 3 campos.
**Lo que cuesta:** "sin moverla" no se dice en ninguna parte: se deduce
porque origen y destino coinciden. "Ahorro sin meta" ya no se crea directo.
Desde Ahorrar sin metas, "Crear una meta" abre el formulario *(verificar si
vuelve a Ahorrar con la meta elegida)*.
**Objetivo:** *por definir.*

#### A7 — Creamos una meta del hogar y aportamos los dos

**Actual — quien la crea**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Planificar | 1 |
| 2 | Planificar | Toca "➕" (Nueva meta) | 1 |
| 3 | Nueva meta | "¿Para qué juntas?" | campo |
| 4 | Nueva meta | "¿La comparten en el hogar?" → 👥 Sí | 1 |
| 5 | Nueva meta | "¿Quién más puede cambiarla?" (opcional) | 0 o 2 |
| 6 | Nueva meta | "¿Cuánto quieres juntar?" | campo |
| 7 | Nueva meta | Guardar | 1 |

**Actual — cada aporte (cualquiera de los dos)**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Hogar | 1 |
| 2 | Hogar | En "🎯 Metas del hogar", toca 🐷 Ahorrar | 1 |
| 3–5 | Ahorrar (meta elegida) | Como A1 pasos 4 a 7 | 3 a 5 + campo |

**Conteo:** crear 2 pantallas · 4 a 6 toques · 2 campos; cada aporte 2
pantallas · 5 a 7 toques · 1 campo.
**Lo que cuesta:** *(verificar)* si la pareja puede ahorrar sin estar en
"¿Quién más puede cambiarla?" (antes, "designados", era requisito).
**Objetivo:** *por definir.*

#### A8 — Cumplí la meta / la quiero reabrir

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | En "Tus metas", toca la meta | 1 |
| 2 | Meta | ✏️ Editar | 1 |
| 3 | Editar meta | "¿Cómo va?" → ✅ Lograda o ⏳ En camino | 1 |
| 4 | Editar meta | Guardar | 1 |

(Al completarse, la meta se marca lograda sola.)
**Conteo:** 3 pantallas · 4 toques.
**Objetivo:** *por definir.*

### 5.3 Hogar

#### H1 — ¿Cuánta plata tenemos como hogar?

**Actual**

| # | Dónde | Qué ve | Toques |
|---|-------|--------|--------|
| 1 | Hogar | Toca la pestaña; ve "🏠 Plata del hogar" (💰 Tienen · 💳 Deben) | 1 |
| 2 | Patrimonio del hogar (opcional) | Toca la cifra; ve la resta por cuentas, bienes y deudas | 1 |

(También: Inicio en "Del hogar".)
**Conteo:** 1 pantalla · 1 toque.
**Lo que cuesta:** el número es correcto solo si cada cuenta "suma al hogar"
(se pregunta al crearla o en Ajustes de la cuenta, ver H4).
**Objetivo:** *por definir.*

#### H2 — ¿Cuánto gastamos este mes, yo y el hogar?

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Movimientos (ve el balance del mes, Míos) | 1 |
| 2 | Movimientos | Toca "Del hogar" (ve el balance del hogar) | 1 |

(Lo propio también se ve en el Inicio, "📊 Así va el mes".)
**Conteo:** 1 pantalla · 2 toques.
**Objetivo:** *por definir.*

#### H3 — Juan programa una transferencia mensual a la Falabella de Zoily

**Actual (ruta más corta, desde el "+")**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 🔁 Moví plata | 1 |
| 3 | Moví plata | Escribe el monto | campo |
| 4 | Moví plata | "¿Desde qué cuenta?" | 2 |
| 5 | Moví plata | "¿A qué cuenta?" → Falabella de Zoily (bajo 👥) | 2 |
| 6 | Moví plata | 🔁 Se repite → Cada mes | 3 |
| 7 | Moví plata | "Anotar movimiento" | 1 |

**Otra ruta:** Planificar → 🗓️ Movimientos programados → Programar
movimiento → 🔁 Moví plata → monto → cuentas → "¿Se repite?" Cada mes →
"¿Cuándo es la primera vez?" → Programar (≈ 12 toques).
**Cada mes:** confirmar como M5 (3 toques).
**Conteo:** 2 pantallas · 10 toques · 1 campo (con M1–M3, la cuenta de salida
viene elegida: 8).
**Lo que cuesta:** era "No se completa" en S01 (D-5); hoy resuelto. Quedan
dos caminos para lo mismo.

**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — igual que M5, en Moví plata.

*La primera vez*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 🔁 Moví plata | 1 |
| 3 | Moví plata | Banda del monto resaltada | Escribe el monto | campo |
| 4 | Moví plata | Las cuentas de la última vez | Si "¿A qué cuenta?" no es la Falabella de Zoily, la elige (bajo 👥) | 0 o 2 |
| 5 | Moví plata | 🔁 Se repite con dos botones | Toca 🔁 Se repite y 🔁 Cada mes | 2 |
| 6 | Moví plata | Pie: "🔁 Pasas X de Cuenta corriente a Falabella (de Zoily) · hoy. … Te avisamos cada mes, el día 9." | "Anotar movimiento" | 1 |

*Cada mes:* como M5, "✅ Sí" en los avisos del Inicio (1 toque).
**Conteo objetivo:** primera vez **5 a 7 toques + monto**; cada mes **1
toque** (meta ✅). Antes: 8 a 10 y 3.

#### H4 — Decido qué ve mi pareja de mis cuentas y qué suma al hogar

**Actual — al crear la cuenta:** la última pantalla de Agregar pregunta
"¿Qué compartes de [cuenta] con [pareja]?" (o "Ahora no").

**Actual — después, por cada cuenta**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | En "Tus cuentas", toca la cuenta | 1 |
| 2 | Detalle | ⚙️ Ajustes de la cuenta | 1 |
| 3 | Ajustes de la cuenta | 👥 Con el hogar: qué ve | 1 a 2 |
| 4 | Ajustes de la cuenta | Si suma al patrimonio del hogar | 1 a 2 |

**Conteo:** 3 pantallas · 4 a 6 toques **por cuenta**.
**Lo que cuesta:** no hay una vista para revisar todas las cuentas de una vez.
**Objetivo:** *por definir.*

#### H5 — Tenemos una deuda juntos (hipotecario o auto) y la pagamos

**Actual — agregar la deuda**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca ➕ Agregar cuenta | 1 |
| 3 | Agregar | 💳 Deuda | 1 |
| 4 | Agregar | "¿De qué tipo?" → Crédito hipotecario | 2 |
| 5 | Agregar | "¿Cómo se llama?" | campo |
| 6 | Agregar | Monto que debes | campo |
| 7 | Agregar | "¿Es una deuda de verdad?" → 💳 Sí, la debo | 1 |
| 8 | Agregar | 👥 Es de varios → Compartida y porcentajes | 2 + campo |
| 9 | Agregar | 🏛️ A quién le debes · 💵 Cuota (opcionales) | 2 + 2 campos |
| 10 | Agregar | "💳 Agregar deuda" | 1 |
| 11 | ¿Qué compartes? | Responde o "Ahora no" | 1 a 2 |

**Actual — cada pago**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | En "Tus cuentas", toca la deuda | 1 |
| 2 | Detalle | 💳 Pagar | 1 |
| 3 | Moví plata (destino elegido) | Escribe el monto | campo |
| 4 | Moví plata | "¿Desde qué cuenta?" | 2 |
| 5 | Moví plata | "Pagar" | 1 |

**Conteo:** agregar 2 pantallas · ≈ 13 toques · 4 a 5 campos; cada pago 3
pantallas · 5 toques · 1 campo.
**Lo que cuesta:** "💳 Pagar tarjeta" del "+" sirve solo para tarjetas; un
dividendo mensual es un programado que no se sugiere.
**Objetivo:** *por definir.*

#### H6 — Invito a mi pareja / acepto la invitación

**Actual — invitar**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Hogar | 1 |
| 2 | Hogar | 👥 Personas del hogar | 1 |
| 3 | Personas del hogar | ➕ Invitar a alguien | 1 |
| 4 | Confirmar | Escribe el correo | campo |
| 5 | Confirmar | Invitar | 1 |

**Actual — aceptar**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Bienvenido (sin hogar) o Hogar | "Tengo una invitación pendiente" o 📩 Te invitaron a otro hogar | 1 a 2 |
| 2 | Invitaciones | Aceptar | 1 |

**Conteo:** invitar 3 pantallas · 4 toques · 1 campo; aceptar 2 pantallas ·
2 a 3 toques.
**Objetivo:** *por definir.*

### 5.4 Cuentas y bienes

#### C1 — Agrego mi cuenta Falabella con su saldo actual

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca ➕ Agregar cuenta | 1 |
| 3 | Agregar | 🏦 Cuenta | 1 |
| 4 | Agregar | "¿De qué tipo?" → Cuenta vista | 2 |
| 5 | Agregar | "¿Cómo se llama?" → Falabella | campo |
| 6 | Agregar | Saldo actual | campo |
| 7 | Agregar | "🏦 Agregar cuenta" | 1 |
| 8 | ¿Qué compartes? | Responde o "Ahora no" | 1 a 2 |

**Conteo:** 2 pantallas · 7 a 8 toques · 2 campos.
**Lo que cuesta:** "¿De qué tipo?" (corriente, vista, RUT…) es obligatoria y
no cambia nada para el usuario común.
**Objetivo:** *por definir.*

#### C2 — Agrego mi tarjeta de crédito con lo que debo

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca ➕ Agregar cuenta | 1 |
| 3 | Agregar | 💳 Deuda | 1 |
| 4 | Agregar | "¿De qué tipo?" → Tarjeta de crédito | 2 |
| 5 | Agregar | "¿Cómo se llama?" | campo |
| 6 | Agregar | Monto que debes | campo |
| 7 | Agregar | "¿Es una deuda de verdad?" → 💳 Sí, la debo | 1 |
| 8 | Agregar | "💳 Agregar deuda" | 1 |
| 9 | ¿Qué compartes? | Responde o "Ahora no" | 1 a 2 |

**Conteo:** 2 pantallas · 8 a 9 toques · 2 campos.
**Lo que cuesta:** no hay cupo ni día de pago, que es lo que el usuario
conoce de su tarjeta; "¿Es una deuda de verdad?" sobra para una tarjeta.
**Objetivo:** *por definir.*

#### C3 — Agrego el auto o la casa y actualizo su valor una vez al año

**Actual — agregar**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca ➕ Agregar cuenta | 1 |
| 3 | Agregar | 🏠 Bien | 1 |
| 4 | Agregar | "¿De qué tipo?" → Vehículo / Propiedad | 2 |
| 5 | Agregar | "¿Cómo se llama?" | campo |
| 6 | Agregar | Cuánto vale | campo |
| 7 | Agregar | 📈 Cambia de valor | 1 |
| 8 | Agregar | "🏠 Agregar bien" | 1 |
| 9 | ¿Qué compartes? | Responde o "Ahora no" | 1 a 2 |

**Actual — cada año:** como A4 (3 toques, 1 campo).
**Conteo:** agregar 2 pantallas · ≈ 9 toques · 2 campos.
**Lo que cuesta:** nada le recuerda actualizar el valor.
**Objetivo:** *por definir.*

#### C4 — Cerré una cuenta

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | En "Tus cuentas", toca la cuenta | 1 |
| 2 | Detalle | 📦 Desactivar | 1 |
| 3 | Confirmar | Escribe el motivo | campo |
| 4 | Confirmar | Desactivar | 1 |

**Conteo:** 3 pantallas · 3 toques · 1 campo. *(verificar)* qué pide si la
cuenta todavía tiene saldo.
**Objetivo:** *por definir.*

### 5.5 Planificación

#### P1 — Me pongo un presupuesto del mes y veo si me pasé

**Actual — crear**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Planificar | 1 |
| 2 | Planificar | "Sin presupuesto vigente" | 1 |
| 3 | Presupuestos | 🧾 Nuevo presupuesto | 1 |
| 4 | Nuevo presupuesto | "¿Cuánto piensas gastar?" (Solo mío y Cada mes vienen elegidos) | campo |
| 5 | Nuevo presupuesto | Guardar | 1 |

**Actual — por categoría (opcional):** Presupuesto → 🧩 Repartir por
categoría → un monto por categoría → 🧩 Guardar reparto.
**Actual — ¿me pasé?:** alerta en el Inicio, tarjeta en Planificar o el
Presupuesto (0 a 1 toque).
**Conteo:** crear 3 pantallas · 4 toques · 1 campo.
**Lo que cuesta:** "Sin presupuesto vigente" pasa por la lista vacía antes
del formulario.
**Objetivo:** *por definir.*

#### P2 — Dejo anotado un pago futuro (arriendo, dividendo)

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Planificar | 1 |
| 2 | Planificar | 🗓️ Movimientos programados | 1 |
| 3 | Programados | 🗓️ Programar movimiento (viene Gasto) | 1 |
| 4 | Programar | Escribe el monto | campo |
| 5 | Programar | "¿Desde qué cuenta sale?" | 2 |
| 6 | Programar | Categoría | 2 |
| 7 | Programar | "¿Para cuándo?" → fecha | 3 |
| 8 | Programar | "🗓️ Programar gasto" | 1 |

**Cuando llega la fecha:** como M5 (3 toques).
**Conteo:** 3 pantallas · 11 toques · 1 campo.
**Lo que cuesta:** hay que saber que "lo que viene" vive en Planificar, en
otra pestaña. Gasté no distinguía una fecha futura ("Otra fecha" deja elegir
cualquier día): la anotaba como si ya hubiera pasado.

**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-8: el "+" anota lo que pasó y deja programado lo que
viene.

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💸 Gasté | 1 |
| 3 | Gasté | Banda del monto resaltada | Escribe el arriendo | campo |
| 4 | Gasté | "¿En qué?" con botones | Toca 🏠 Arriendo (o 🔍 Otra) | 1 |
| 5 | Gasté | La cuenta de la última vez | Nada | 0 |
| 6 | Gasté | ¿Cuándo? Hoy · Ayer · 📅 Otra fecha | 📅 Otra fecha → 5 nov | 3 |
| 7 | Gasté | Como la fecha es futura, la banda dice **"🗓️ Para el 5 nov: se anota ese día"** y el pie: "🗓️ Lo dejamos anotado para el 5 nov. Ese día te preguntamos si se pagó." | "🗓️ Programar gasto" | 1 |

Con una fecha futura solo se programa lo tuyo: lo de otra persona, lo
compartido, un cambio de moneda o la plata de una meta se anotan el día que
pasan (el pie lo dice y el botón queda desactivado). Las etiquetas no se
ofrecen, porque el programado no las guarda.

Si además se repite (dividendo), 🔁 Se repite → Cada mes (+2): la primera vez
es el 5 nov. Llegada la fecha, "✅ Sí" en los avisos del Inicio, como M5.
"Programar movimiento" en Planificar sigue existiendo para quien lo busque
ahí.

**Conteo objetivo:** 2 pantallas · **7 toques + monto** (meta T2 ≤ 8 ✅).
Antes: 3 pantallas · 11.

## 6. Lectura del recorrido y patrones candidatos

**Lo que mejoró desde S01:** los 7 escenarios que no se podían completar o
pedían conocimiento previo por dominio (A1, A2, A5, M7, M8, M10, H3) hoy
tienen un camino directo. El problema dejó de ser "no se puede" y pasó a ser
"cuesta": los T1 diarios (M1–M3) piden 7 a 10 toques y casi la mitad son
elegir en hojas cosas que el usuario repite siempre igual.

**Patrones candidatos** (cada uno se decide al trabajar su primer escenario):

| # | Patrón | Escenarios que toca | Ahorro estimado | Estado |
|---|--------|---------------------|-----------------|--------|
| F-1 | **Cuenta recordada:** la cuenta (o el par de cuentas, en Moví plata) del último movimiento del mismo tipo viene elegida, se ve como paso hecho y se cambia tocándola. | M1, M2, M3, M6, M7, M8, M10, P2 | −2 toques por cuenta | ✅ en M1–M3 (§9) |
| F-2 | **Categoría en chips:** las 4 categorías más usadas de ese tipo, a un toque, y "🔍 Otra" para la lista completa. | M1, M2, M5, M7, A5, P2 | −1 toque | ✅ en M1–M2 (§9) |
| F-3 | **Confirmar desde el Inicio en un toque:** lo programado que ya venció aparece en los avisos del Inicio con "✅ Sí", que anota con el monto y la fecha previstos; la fila abre el Programado para los otros casos. | M5, H3, P2, H5 | −2 toques por mes | ✅ en M5 y H3 (§9) |
| F-4 | **Personas como respuesta directa:** "¿De quién es?" ofrece las personas recientes (Noira, Papás) junto a Mío y Compartido. | M8, M10 | −2 toques | ⬜ |
| F-5 | **Pagar una deuda** (no solo tarjeta) en la hoja "+", con el monto que debes sugerido. | M6, H5 | −2 toques y 0 campos | ⬜ |
| F-6 | **Tipo opcional** al agregar: se deja en el genérico sin preguntar. | C1, C2, C3 | −2 toques | ⬜ |
| F-7 | **Motivo opcional** en correcciones y eliminaciones de movimientos propios. | M12, M13, C4 | −1 campo | ⬜ |
| F-8 | **El "+" para todo lo que se repite o viene:** "🔁 Se repite" muestra Cada mes · Cada año como botones, y una fecha futura en Gasté / Recibí / Moví plata deja el movimiento programado en vez de anotarlo. Programar en Planificar sigue existiendo. | M5, H3, P2 | −1 a −4 toques; una sola puerta | ✅ en M5, H3 y P2 (§9) |

## 7. Orden de trabajo

Frecuencia primero; los primeros fijan los patrones.

1. **M1, M2, M3** — el formulario base (F-1, F-2). Lo que se decida aquí
   cambia 15 escenarios. ✅ implementado y mergeado (§9).
2. **M5, H3, P2** — lo que se repite (F-3, F-8). ✅ implementado y mergeado (§10).
3. **M6, H5** — tarjetas y deudas (F-5).
4. **M4, M7, M9** — entre miembros del hogar.
5. **M8, M10** — plata de otras personas (F-4).
6. **A1, A2, A5, A6, A7, A8, A3, A4** — metas y valor.
7. **C1, C2, C3, C4** — agregar y cerrar (F-6).
8. **M12, M13, M11** — corregir, borrar y monedas (F-7).
9. **H1, H2, H4, H6, P1** — consultas y configuración.

Cada escenario trabajado reemplaza su "Objetivo: por definir" con la tabla de
pasos aprobada, el conteo antes → después, la rama, la verificación y la
fecha.

## 8. Decisiones del frente

| # | Decisión | Estado |
|---|----------|--------|
| S3-1 | Se trabajan los 33 escenarios; los primeros fijan los patrones. | ✅ Juan, 2026-10-09 |
| S3-2 | Entra la estructura de los flujos (por defecto, orden, atajos); lo visual de G35 se mantiene. | ✅ Juan, 2026-10-09 |
| S3-3 | Meta: T1 en ≤ 4 toques + monto; T2 en ≤ 8. | ✅ Juan, 2026-10-09 |
| S3-4 | Patrones F-1 a F-8 (§6). F-1 y F-2 aprobados con M1–M3; F-3 y F-8 con M5, H3 y P2. | 🟡 F-1, F-2, F-3 y F-8 ✅ Juan, 2026-10-09; el resto al trabajar cada escenario |
| S3-5 | Los pasos tienen que quedar muy claros: nada se esconde para ahorrar toques (§2) y cada flujo se documenta en tabla paso a paso. | ✅ Juan, 2026-10-09 |
| S3-6 | F-1: la "cuenta recordada" sale del último movimiento anotado de esa puerta (igual en todos los teléfonos, sin guardar nada nuevo). Para eso el resumen de movimientos de la API suma la cuenta de salida y de llegada de cada uno (solo lectura, sin migración). | ✅ Juan, 2026-10-09 |

## 9. Implementación de M1–M3 (rama `feat/G39-formulario-base`)

**Estado:** ✅ aprobado por Juan y mergeado a `main` (2026-10-09). La API
requiere deploy en Render.

- **API (solo lectura):** `GET /usuarios/me/resumen-financiero` suma a cada
  movimiento `elementoOrigenId`, `elementoDestinoId` (impacto negativo /
  positivo) y `registradoEn` (`reporte.service`, `reporte.dto`). Sin
  migración. **Requiere deploy en Render.** e2e de reporte 7/7 contra
  `patrimonia_test`, con una aserción nueva.
- **App:**
  - `src/recientes.ts` (con `recientes.test.ts`, 6/6): `ultimaCuenta` (la del
    último movimiento anotado de esa puerta; la de salida tiene que ser tuya y
    solo la de llegada, en Moví plata, puede ser de alguien del hogar) y
    `categoriasMasUsadas` (90 días, por cantidad y luego por la más reciente).
  - `RegistrarMovimientoScreen`: al entrar por el "+" sin cuenta elegida,
    viene la de la última vez, con la línea "🔁 La de tu último gasto /
    ingreso" o "🔁 Las de la última vez. Tócalas para cambiarlas.". No se
    preelige al entrar con una cuenta ya elegida (detalle, Hogar, Meta,
    Frecuente) ni en Pagar tarjeta. Moví plata recuerda solo movimientos entre
    cuentas (no pagos de deudas, que tienen su puerta).
  - "¿En qué? (opcional)" (Gasté) / "¿De qué? (opcional)" (Recibí) va antes de
    la cuenta, con las categorías más usadas como botones y "🔍 Otra" para la
    lista completa (y crear una nueva). Tocar la elegida la quita. Sin
    historial, queda la lista de siempre.
  - Pie: dice solo lo que falta ("Completa el monto.") y, con todo listo,
    también la categoría y el día ("💸 Salen 1.000 CLP de Cuenta corriente ·
    Mercado · hoy.").
- **Verificado:** `tsc` sin errores (app y `src` de la API); capturas web de
  Gasté, Recibí y Moví plata (vacío y lleno) como Demo. Se anotó un gasto de
  prueba de 1.000 CLP sin categoría desde la cuenta recordada (queda en la
  base local) y al volver a abrir Gasté vino la misma cuenta.
- **Conteo logrado:** M1 4 toques + monto (7 con el 18-sep) · M2 4 + monto ·
  M3 3 + monto. Meta S3-3 ✅ en los tres.

## 10. Implementación de M5, H3 y P2 (rama `feat/G39-repite`)

**Estado:** ✅ aprobado por Juan y mergeado a `main` (2026-10-09). Solo app
(sin cambios en la API).

- **F-3 · "✅ Sí" en el Inicio** (`DashboardScreen`): los programados
  pendientes cuya fecha ya llegó entran a los avisos del Inicio, los más
  antiguos primero: "⏰ ¿Pagaste / ¿Te llegó / ¿Hiciste [nombre]?" y debajo
  "monto · era el [día]". "✅ Sí" los anota con el monto y la fecha previstos
  (`MaterializarMovimientoProgramado`, igual que "Sí, se pagó" del
  Programado); la fila abre el Programado ("Fue otro monto", "Este mes no").
  Los avisos siguen mostrando 3 como máximo.
- **F-8 · "🔁 Se repite" con botones** (`RegistrarMovimientoScreen`): al
  abrirlo aparecen 🔁 Cada mes · 📆 Cada año; tocar el elegido lo quita.
- **F-8 · fecha futura = programar** (`RegistrarMovimientoScreen`): con una
  fecha posterior a hoy, Gasté / Recibí / Moví plata crean un movimiento
  programado (`CrearMovimientoProgramado`, con categoría, detalle y "se
  repite") en vez de anotarlo. La banda dice "🗓️ Para el 5 nov: se anota ese
  día", el pie "🗓️ Lo dejamos anotado para el 5 nov. Ese día te preguntamos
  si se pagó." y el botón "🗓️ Programar gasto / ingreso / movimiento / pago".
  Lo que el programado no guarda (de otra persona, compartido, cambio de
  moneda, plata de una meta) no se puede programar: el pie lo dice y el botón
  queda desactivado. Sin Etiquetas con fecha futura.
- **Verificado:** `tsc` sin errores; capturas web como Demo:
  - Inicio con un programado vencido de prueba (18.000, 7 oct): "✅ Sí" lo
    anotó (queda MATERIALIZADO con su movimiento) y el aviso desapareció; con
    otro (8 oct), tocar la fila abre el Programado ("Tocaba pagar · ¿se
    pagó?"). Este segundo queda pendiente en la base local para probar en el
    teléfono.
  - Gasté con "Se repite → Cada mes": pie "… · hoy. Te avisamos el 9 de cada
    mes." (no se anotó).
  - Gasté de 450.000 con fecha 5 nov: pie y botón de programar; al tocarlo
    quedó un programado PENDIENTE para el 5 nov (sin movimiento) en la base
    local.
- **Conteo logrado:** confirmar cada mes (M5, H3) 1 toque · M5 la primera vez
  6 + monto · P2 7 + monto.
