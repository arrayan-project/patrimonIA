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

## 0. Estado al cierre del 2026-10-09 y lo que sigue

**Hecho:** bloques 1 a 7 (24 de los 33 escenarios) aprobados por Juan,
mergeados a `main` (último merge `482605f`), con push y deploy en Render
hechos por Juan. Patrones F-1 a F-6 y F-8 a F-19 decididos (§6). La
recuperación de contraseña en la nube quedó probada por Juan (llega el
código de 6 dígitos).

| Bloque | Escenarios | Sección |
|--------|------------|---------|
| 1 | M1, M2, M3 · formulario base | §9 |
| 2 | M5, H3, P2 · lo que se repite | §10 |
| 3 | M6, H5 · tarjetas y deudas | §11 |
| 4 | M4, M7, M9 · entre miembros del hogar | §12 |
| 5 | M8, M10 · plata de otras personas | §13 |
| 6 | A1–A8 · metas y ahorro (A3, A4, A5, A8 se mantienen) | §14 |
| 7 | C1, C2, C3 · agregar cuentas y aviso anual de valor | §15 |
| 8 | M12, M13, C4, M11 · corregir, borrar, cerrar y monedas | §16 |
| 9 | H1, H2, H4, H6, P1 · consultas y configuración (H2 se mantiene) | §17 |

**Hecho: bloque 8 — M12, M13, C4 y M11** (corregir, borrar, cerrar y
monedas), aprobado por Juan y mergeado (2026-10-10, §16). Toca la API
(requiere deploy en Render), sin migración.

**Hecho: bloque 9 — H1, H2, H4, H6 y P1**, aprobado por Juan y mergeado
(2026-10-10, §17), solo app. Con eso quedan los 33 escenarios trabajados.

Bloque 9: consultas y configuración. Pistas
del recorrido: H4 no tiene una vista para revisar qué comparte cada cuenta de
una vez; P1 pasa por la lista vacía de Presupuestos antes del formulario.

**Datos de prueba que quedaron en la base local** (`patrimonia`, Demo y
Pareja): un gasto de 1.000 CLP sin categoría (Cuenta corriente de Demo); el
programado "Prueba G39 internet" (18.000, 7 oct, confirmado) y otro igual del
8 oct pendiente; un programado de 450.000 para el 5 nov; un gasto compartido de
30.000 con su solicitud de 15.000 a Pareja pendiente; la meta compartida
"Prueba G39 vacaciones" (1.500.000, Pareja puede ahorrar).

**Para retomar en local:** `./scripts/db.sh`, `./scripts/api.sh` y
`./scripts/app-local.sh` (Docs/CORRER_EN_LOCAL.md). En local los correos no se
envían: sin `BREVO_API_KEY` en `api/.env`, el código de registro o de
recuperación aparece en la terminal de `api.sh`.

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
**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-9 y F-10 (§6).

*Desde el "+" (la pareja en una pregunta propia)*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 🔁 Moví plata | 1 |
| 3 | Moví plata | Banda del monto resaltada | Escribe 15.000 | campo |
| 4 | Moví plata | **"¿A dónde va la plata?"** con dos botones: **🙋 A otra cuenta mía** · **👤 A Pareja** | Toca 👤 A Pareja | 1 |
| 5 | Moví plata | "¿A qué cuenta de Pareja?": si Pareja deja ver una sola, viene elegida | Nada (2 si tiene varias) | 0 |
| 6 | Moví plata | "¿Desde qué cuenta?": la de la última vez, con "🔁 Tócala para cambiarla" | Nada | 0 |
| 7 | Moví plata | Pie: "🔁 Le pasas 15.000 a Pareja (Cuenta RUT) desde Cuenta corriente · hoy. **Hazla en tu banco; acá solo queda anotada. Pareja no tiene que anotar nada.**" | "Anotar movimiento" | 1 |

Si Pareja no deja ver ninguna cuenta, en el paso 5 aparece, en vez de la
lista: "**Pareja todavía no te deja ver sus cuentas.** Pídele que, en su
teléfono, abra su cuenta › ⚙️ Ajustes de la cuenta › 👥 Con el hogar." y el
botón queda desactivado.

*Desde Hogar › "🔁 Para transferirles"* (atajo que ya existe): la cuenta de
Pareja viene elegida y ahora también la de salida (la de la última vez):
Hogar · cuenta de Pareja · monto · Anotar = **3 toques + monto**.

**Conteo objetivo:** desde el "+" **4 toques + monto** (meta ✅, antes 7);
desde Hogar 3 + monto (antes 5).

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
Gasté indica que la tarjeta se elige como cuenta, y esa lista mezcla cuentas
con bienes (la casa, el auto) y con lo que te deben.

**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-5 (§6) y la lista de Gasté.

*La compra (Gasté)*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💸 Gasté | 1 |
| 3 | Gasté | Banda del monto resaltada | Escribe el monto | campo |
| 4 | Gasté | "¿En qué?" con botones | Toca una categoría | 1 |
| 5 | Gasté | "¿Desde qué cuenta pagaste?": viene la de la última vez. Al tocarla, la lista muestra solo **🏦 Cuentas · 🐷 Ahorro · 📈 Inversiones · 💳 Tarjetas y créditos** (salen los bienes y lo que te deben, que no pagan nada) | Si no viene la tarjeta, la elige en "💳 Tarjetas y créditos" | 0 o 2 |
| 6 | Gasté | Pie: "💸 Salen 25.000 de Tarjeta Visa · Mercado · hoy." | "Anotar gasto" | 1 |

*El pago*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | La fila **💳 Pagar una deuda** · "Tarjeta, crédito o préstamo" (antes "Pagar tarjeta", solo tarjetas) | La toca | 1 |
| 3 | Pagar | Banda del monto con dos botones: **💳 Todo lo que debes · 480.000** y **💵 La cuota · 120.000** (este, solo si la deuda tiene cuota) | Toca "Todo lo que debes" (o escribe otro monto) | 1 |
| 4 | Pagar | "¿Qué deuda pagas?": viene la única, o la que pagó la última vez, con "🔁 La de tu último pago" | Nada (2 si es otra) | 0 |
| 5 | Pagar | "¿Desde qué cuenta?": la de su último pago de una deuda | Nada | 0 |
| 6 | Pagar | Pie: "💳 Pagas 480.000 de Tarjeta Visa desde Cuenta corriente · hoy. Te queda 0 por pagar." | "💳 Pagar" | 1 |

**Conteo objetivo:** compra **4 toques + monto** (meta ✅, antes 7); pago
**4 toques y 0 campos** (meta ✅, antes 5 + monto).

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
**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-10, F-11 y F-12 (§6).

*Quien pagó*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💸 Gasté | 1 |
| 3 | Gasté | Banda del monto resaltada | Escribe 60.000 | campo |
| 4 | Gasté | **"¿De quién es este gasto?"** como tres botones a la vista: **🙋 Mío · 👫 Con Pareja · 👤 De otra persona**; debajo, una línea dice qué significa el elegido ("👫 Pagaste algo de los dos y Pareja te transfiere su parte") | Toca 👫 Con Pareja | 1 |
| 5 | Gasté | **"¿Pareja ya te pasó su parte?"**: **⏳ No, que me la pase** (elegido) · **✅ Sí, ya me la pasó** | Nada | 0 |
| 6 | Gasté | "¿Cuánto le toca a Pareja?": ➗ La mitad · 30.000 (elegido) | Nada | 0 |
| 7 | Gasté | "¿En qué?" con botones | Toca 🛒 Mercado | 1 |
| 8 | Gasté | Cuenta del gasto (la de la última vez) y "¿A qué cuenta te transfiere?" (la misma) | Nada | 0 |
| 9 | Gasté | Pie: "💸 Salen 60.000 de Cuenta corriente · Mercado · hoy. **Le pedimos a Pareja sus 30.000: le llega un aviso para transferirte a Cuenta corriente.**" | "Anotar gasto" | 1 |

*Pareja*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | Aviso "🤝 Demo te pide tu parte: 30.000 · Mercado" | Lo toca | 1 |
| 2 | Pagar | Banda "🧾 Tu parte de Mercado"; "¿Desde qué cuenta le transfieres?" ya dice la de su última transferencia; línea **"Primero transfiérele en tu banco; acá queda anotado."** | Nada | 0 |
| 3 | Pagar | Botón **"✅ Ya le transferí 30.000"** (antes "Transferir", que parecía que la app movía la plata) | Lo toca | 1 |

**Conteo objetivo:** quien pagó **5 toques + monto** (4 sin categoría; antes
9); la pareja **2 toques** (antes 2 a 4).

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
**Ya mejorado por bloques anteriores:** "¿De quién es?" en botones (F-11) y
la cuenta de la última vez (F-1): hoy son 7 toques por parte.

**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-4 y F-13 (§6).

*Llega la plata*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💰 Recibí | 1 |
| 3 | Recibí | Banda del monto resaltada | Escribe 30.000 | campo |
| 4 | Recibí | "¿De quién es esta plata?": 🙋 Mía · 👤 De otra persona · 👥 De alguien del hogar | Toca 👤 De otra persona | 1 |
| 5 | Recibí | **"¿De quién?"** como botones: las personas con las que tiene algo pendiente primero (máx. 4) y **➕ Otra persona** | Toca ➕ Otra persona y escribe "Noira" | 1 + campo |
| 6 | Recibí | "¿A qué cuenta llegó?": la de la última vez | Nada | 0 |
| 7 | Recibí | Pie: "💰 Entran 30.000 a Falabella · hoy. No es ingreso tuyo: **tienes 30.000 de Noira.**" | "Anotar plata de otra persona" | 1 |

*La compra*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💸 Gasté | 1 |
| 3 | Gasté | "¿De quién es este gasto?" | Toca 👤 De otra persona | 1 |
| 4 | Gasté | "¿De quién?" con **👤 Noira** (tiene plata suya) y debajo "💵 Tienes 30.000 de Noira" | Toca 👤 Noira | 1 |
| 5 | Gasté | En la banda del monto aparece **💵 Todo lo de Noira · 30.000** | Lo toca (o escribe otro monto) | 1 |
| 6 | Gasté | La cuenta de la última vez | Nada | 0 |
| 7 | Gasté | Pie: "💸 Salen 30.000 de Falabella · hoy. No es gasto tuyo: **Noira y tú quedan a mano.**" | "Anotar plata de otra persona" | 1 |

**Conteo objetivo:** llega 5 toques + monto + nombre; compra **6 toques, sin
escribir** (antes 9 + monto cada una).

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
**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-11 (§6). El dominio no cambia
(la atribución por persona sigue fuera de alcance, `DECISIONES_FASE_D_S01.md`
§3): el gasto de 200.000 queda en Zoily, como hoy; lo que cambia es que la
app le dice claramente qué hacer y no le pide a Juan una plata que ya pasó.

*Juan:* como M4 (👤 A Zoily), 4 toques + monto.

*Zoily*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💸 Gasté | 1 |
| 3 | Gasté | Banda del monto resaltada | Escribe 200.000 | campo |
| 4 | Gasté | "¿De quién es este gasto?" | Toca 👫 Con Juan | 1 |
| 5 | Gasté | "¿Juan ya te pasó su parte?" | Toca **✅ Sí, ya me la pasó** | 1 |
| 6 | Gasté | Aparece lo que Juan le transfirió en los últimos 30 días: "✅ Juan te pasó 100.000 · 8 oct · a Falabella" y "¿Cuánto era de Juan?": ➗ La mitad · 100.000 (elegido) · ✏️ Otro monto | Nada | 0 |
| 7 | Gasté | Cuenta del gasto (la de la última vez) | Nada | 0 |
| 8 | Gasté | Pie: "💸 Salen 200.000 de Falabella · hoy. **Juan ya te pasó sus 100.000: no le pedimos nada.**" | "Anotar gasto" | 1 |

Se anota un gasto de 200.000 (como hoy) y, si no escribió un detalle, queda
"Juan puso 100.000" en el detalle (la etiqueta informativa que
`DECISIONES_FASE_D_S01.md` §3 dejaba como "camino barato"; ✅ Juan,
2026-10-09).

**Conteo objetivo:** Zoily **5 toques + monto** (meta T2 ≤ 8 ✅, antes 7); y
sobre todo, ya no puede pedirle a Juan una plata que ya le pasó.

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
**Ya mejorado por bloques anteriores:** "¿De quién es?" en botones y la cuenta
de la última vez.

**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-4, F-13 y F-14 (§6).

*La compra*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💸 Gasté | 1 |
| 3 | Gasté | Banda del monto resaltada | Escribe 25.000 | campo |
| 4 | Gasté | "¿De quién es este gasto?" | Toca 👤 De otra persona | 1 |
| 5 | Gasté | "¿De quién?" | Toca ➕ Otra persona y escribe "Papás" (o 👤 Papás si ya existe) | 1 + campo |
| 6 | Gasté | **"¿De dónde sale esta plata?"** (solo si no hay nada pendiente con esa persona): **🤝 La pongo yo: Papás me la devuelve** · **💵 Es de Papás: me la había pasado** | Toca 🤝 La pongo yo | 1 |
| 7 | Gasté | La cuenta de la última vez | Nada | 0 |
| 8 | Gasté | Pie: "💸 Salen 25.000 de Cuenta corriente · hoy. No es gasto tuyo: **Papás te debe 25.000.**" | "Anotar plata de otra persona" | 1 |

Si toca "💵 Es de Papás: me la había pasado", aparece una sola pregunta más,
"¿La anotaste cuando te llegó?": **No la anoté** · **Sí, como ingreso mío**
(y elige cuál; "Lo corregimos para que no cuente como tuyo").

*La devolución*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 💰 Recibí | 1 |
| 3 | Recibí | "¿De quién es esta plata?" | Toca 👤 De otra persona | 1 |
| 4 | Recibí | "¿De quién?" con **👤 Papás** primero y "🤝 Papás te debe 25.000" | Toca 👤 Papás | 1 |
| 5 | Recibí | En la banda, **💵 Lo que te debe · 25.000** | Lo toca | 1 |
| 6 | Recibí | Pie: "💰 Entran 25.000 a Cuenta corriente · hoy. No es ingreso tuyo: **Papás y tú quedan a mano.**" | "Anotar plata de otra persona" | 1 |

**Conteo objetivo:** compra 6 toques + monto + nombre (antes 11 + 2 campos);
devolución **6 toques, sin escribir** (antes 9 + monto).

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
*(verificado: sin tasa la API rechaza "No hay tipo de cambio…"; en la nube
USD, EUR y UF se importan cada hora desde mindicador.cl)*. Lo que de verdad
cuesta: no se ve cuánto llega, y el banco no cambia al dólar observado, así
que el saldo en dólares queda distinto al real.

**Objetivo (aprobado por Juan, 2026-10-10)**

| # | Dónde | Qué ve / qué hace | Toques |
|---|-------|-------------------|--------|
| 1 | Inicio | Toca "+" | 1 |
| 2 | Hoja "+" | Toca 🔁 Moví plata | 1 |
| 3 | Moví plata | Escribe el monto | campo |
| 4 | Moví plata | "¿A qué cuenta?" → cuenta en USD | 2 |
| 5 | Moví plata | "¿Desde qué cuenta?" viene la de la última vez (F-1) | 0 |
| 6 | Moví plata | **"¿Cuántos USD llegaron?"** ya lleno al cambio del día ("💱 1 USD = 960 CLP. Si tu banco te dio otro, escribe lo que llegó"); se cambia si el banco dio otro | 0 (+ campo) |
| 7 | Moví plata | Pie: "Cambias 100.000 CLP de Cuenta corriente y llegan 104,17 USD a Cuenta en dólares · hoy." → Anotar cambio de moneda | 1 |

Sin tasa del día, el paso 6 lo dice ahí mismo y basta con escribir lo que
llegó (ya no hace falta ir a Ajustes). **Conteo:** 2 pantallas · 5 toques ·
1 campo (+1 si el banco dio otro cambio). Implementado en §16.

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
el tipo no se cambian (hay que eliminar y anotar de nuevo). *(Verificado: la
API exige el motivo, DDD §T y §U; la categoría tampoco se cambia; un
movimiento ya cambiado no se puede volver a editar, y abierto desde la lista
mostraba el monto original.)*

**Objetivo (aprobado por Juan, 2026-10-10)**

| # | Dónde | Qué ve / qué hace | Toques |
|---|-------|-------------------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Movimientos | 1 |
| 2 | Movimientos | Toca el movimiento | 1 |
| 3 | Movimiento | ✏️ Editar | 1 |
| 4 | Editar movimiento | Escribe el monto correcto | campo |
| 5 | Editar movimiento | "¿Por qué lo cambias?" viene en **✏️ Me equivoqué al anotarlo** (F-7); "✍️ Otro" abre el campo | 0 |
| 6 | Editar movimiento | Guardar cambios | 1 |

**Conteo:** 3 pantallas · 4 toques · 1 campo.

**Era otra cuenta, otro tipo u otra categoría (M12b):** en Editar,
"🔁 Anotar de nuevo" abre el formulario del "+" lleno (monto, fecha, cuentas,
categoría y detalle), con "¿Qué fue?" (💸 Gasté · 💰 Recibí · 🔁 Moví plata)
arriba. El pie termina en "Reemplaza el gasto de 12.000 CLP del 10 oct: ese se
elimina." Al anotar, se elimina el anterior (y sus cambios) y se vuelve a
donde se abrió. Es también el camino para cambiar de nuevo un movimiento ya
cambiado y para un cambio de moneda (que no se edita). **Conteo:** 3
pantallas · 5 a 7 toques · 0 campos.

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

**Objetivo (aprobado por Juan, 2026-10-10)**

| # | Dónde | Qué ve / qué hace | Toques |
|---|-------|-------------------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Movimientos | 1 |
| 2 | Movimientos | Toca el movimiento | 1 |
| 3 | Movimiento | 🗑️ Eliminar movimiento | 1 |
| 4 | Eliminar movimiento | "¿Por qué lo eliminas?" viene en **🙅 No pasó** (F-7); 👯 Estaba repetido · ✍️ Otro | 0 |
| 5 | Eliminar movimiento | Eliminar movimiento | 1 |

**Conteo:** 3 pantallas · 4 toques · 0 campos.

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
**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-15 y F-16 (§6).

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 🐷 Ahorrar para una meta | 1 |
| 3 | Ahorrar | **"¿Para qué meta?"** como botones con su emoji (hasta 4 metas en camino, "🔍 Ver todas" si hay más, "➕ Nueva meta"); si hay una sola, viene elegida | Toca 🏠 Hogar | 1 |
| 4 | Ahorrar | Banda de la meta (Llevas, %). "¿En qué cuenta guardas la plata de esta meta?": viene la de siempre (Fintual) | Nada | 0 |
| 5 | Ahorrar | "¿De dónde sale la plata?": **la de tu último ahorro para esa meta** (Falabella), con "🔁 La de la última vez. Tócala para cambiarla." | Nada | 0 |
| 6 | Ahorrar | "¿Cuánto?" con "💯 Todo lo libre (1.000.000)" | Escribe el monto o toca "Todo lo libre" | campo o 1 |
| 7 | Ahorrar | Pie: "🔁 Se mueven 1.000.000 de Falabella a Fintual. **Hazlo también en tu banco; acá queda anotado.**" | "Guardar" | 1 |

**Conteo objetivo:** **4 toques + monto** (meta ✅, antes 7 a 9). Desde la
tarjeta de la meta ("🐷 Ahorrar"), 3 + monto.

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
**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — lo mismo que A1 (F-15, F-16):
la meta y la primera cuenta vienen elegidas, y cada cuenta se vacía con
"💯 Todo lo libre".

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1–2 | Inicio → Ahorrar | — | "+" · 🐷 Ahorrar | 2 |
| 3 | Ahorrar | "¿Para qué meta?" en botones | Toca la meta | 1 |
| 4 | Ahorrar | Primera cuenta: la de la última vez | "💯 Todo lo libre" | 1 |
| 5 | Ahorrar | "➕ Sumar otra cuenta" | Lo toca y elige la segunda cuenta | 3 |
| 6 | Ahorrar | Segunda cuenta | "💯 Todo lo libre" | 1 |
| 7 | Ahorrar | Pie con lo que se mueve de cada cuenta | "Guardar" | 1 |

**Conteo objetivo:** 9 toques, sin escribir (antes 12 a 14). Es el único T1
que no llega a 4: junta dos cuentas en una sola operación.

#### A3 — ¿Cuánto llevo para la meta y cuánto me queda libre?

**Actual**

| # | Dónde | Qué ve | Toques |
|---|-------|--------|--------|
| 1 | Inicio | Bajo el total: 🐷 Guardado para metas y ✅ Puedes gastar; en "Tus metas", el avance de cada una | 0 |
| 2 | Meta (opcional) | Toca una meta para ver el detalle | 1 |

**Conteo:** 1 pantalla · 0 toques.
**Lo que cuesta:** nada relevante.
**Objetivo (✅ se mantiene):** ya se ve en el Inicio sin tocar nada.

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
**Objetivo (✅ se mantiene):** 3 toques + valor. Si la cuenta no "cambia de
valor", el Detalle ofrece "🔧 Corregir el saldo" ("¿Cuánto tiene de
verdad?"), que también se entiende solo.

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
**Objetivo (✅ se mantiene):** con los bloques anteriores ya son 4 toques +
monto (meta ✅): la meta → "💸 Usar plata de la meta" → monto → categoría en
botones → Anotar.

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
**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-15 y F-17 (§6).

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca 🐷 Ahorrar para una meta | 1 |
| 3 | Ahorrar | "¿Para qué meta?" con "➕ Nueva meta" | Toca ➕ Nueva meta | 1 |
| 4 | Nueva meta | "¿Para qué juntas?" y "¿Cuánto quieres juntar?" | Escribe "Vacaciones" y 1.500.000 | 2 campos |
| 5 | Nueva meta | — | "Guardar" | 1 |
| 6 | Ahorrar | **Vuelve con "Vacaciones" ya elegida** (hoy vuelve sin la meta nueva) | — | 0 |
| 7 | Ahorrar | "¿De dónde sale la plata?" → Cuenta corriente; como es la primera vez, "¿En qué cuenta guardas…?" viene en la misma | Elige la cuenta | 2 |
| 8 | Ahorrar | "¿Cuánto?" | Escribe 300.000 | campo |
| 9 | Ahorrar | Pie: "🐷 **La plata se queda en Cuenta corriente**, separada para Vacaciones: no se mueve." | "Guardar" | 1 |

**Conteo objetivo:** 7 toques + 3 campos (antes ≈ 13 + 3).

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
**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-18 (§6).

**Lo que hoy falla sin avisar:** la pareja solo puede ahorrar en la meta si
quien la creó la marcó en "¿Quién más puede cambiarla? (opcional)". El campo
parece opcional y habla de "cambiarla", no de ahorrar: si nadie lo marca, la
pareja ve la meta pero no puede aportar.

*Quien la crea*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Planificar | — | Toca ➕ Nueva meta | 2 |
| 2 | Nueva meta | "¿Para qué juntas?" | Escribe "Casa" | campo |
| 3 | Nueva meta | "¿La comparten en el hogar?" 🙋 No, es mía · 👥 Sí | Toca 👥 Sí | 1 |
| 4 | Nueva meta | **"¿Quién más puede ahorrar en ella?"** con todos los del hogar **ya marcados** (se pueden quitar) | Nada | 0 |
| 5 | Nueva meta | "¿Cuánto quieres juntar?" | Escribe el monto | campo |
| 6 | Nueva meta | — | "Guardar" | 1 |

*La pareja, cada aporte:* Hogar → 🎯 Metas del hogar → 🐷 Ahorrar → como A1
desde la meta (cuenta de la última vez, "Todo lo libre" o monto) → Guardar:
**4 toques + monto**.
Si una meta del hogar no la deja ahorrar, la Meta dice "👀 [quien la creó]
no te agregó para ahorrar en esta meta" en vez de no mostrar el botón.

**Conteo objetivo:** crear 4 toques + 2 campos; cada aporte 4 + monto, y la
pareja siempre puede aportar salvo que la saquen a propósito.

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
**Objetivo (✅ se mantiene):** 4 toques, y la meta se marca lograda sola
al completarse.

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

**Objetivo (aprobado por Juan, 2026-10-10)**

| # | Dónde | Qué ve | Toques |
|---|-------|--------|--------|
| 1 | Hogar | "🏠 Plata del hogar" y debajo **"🔐 De lo tuyo suman 2 de 7 · Revisa qué compartes ›"** | 1 |
| 2 | (opcional) | La fila abre "Qué compartes" (H4) | 1 |

**Conteo:** 1 pantalla · 1 toque; queda a la vista qué parte de lo tuyo
entra en la cifra. Implementado en §17.

#### H2 — ¿Cuánto gastamos este mes, yo y el hogar?

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Movimientos (ve el balance del mes, Míos) | 1 |
| 2 | Movimientos | Toca "Del hogar" (ve el balance del hogar) | 1 |

(Lo propio también se ve en el Inicio, "📊 Así va el mes".)
**Conteo:** 1 pantalla · 2 toques.
**Objetivo:** se mantiene (Juan, 2026-10-10): ya cumple la meta.

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

**Objetivo (aprobado por Juan, 2026-10-10)**

| # | Dónde | Qué ve / qué hace | Toques |
|---|-------|-------------------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Hogar | 1 |
| 2 | Hogar | "De lo tuyo suman…" o Más del hogar › 🔐 Qué compartes (también en Ajustes) | 1 |
| 3 | Qué compartes con [pareja] | Tus cuentas en dos grupos: "🏠 Suman a la plata del hogar (N)" y "🙋 Solo tuyas (N)", cada una con lo que ve el hogar (🔒 Solo tú la ves · 🔁 Puede transferirte · 👀 Ve el saldo · 👀 Ve todo · ⚙️ A tu medida) | 0 |
| 4 | Qué compartes | Toca la cuenta → la hoja con los 4 niveles de siempre → se guarda al instante y la cuenta cambia de grupo | 2 por cuenta |

**Conteo:** 2 pantallas · 2 toques + 2 por cuenta (antes 3 pantallas y 4 a
6 toques por cuenta). Implementado en §17.

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

**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — el pago, con F-5 (igual que M6).
Agregar la deuda se trabaja con C1–C3 (bloque 7).

*Cada pago (cada uno, desde su teléfono)*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | 💳 Pagar una deuda | La toca | 1 |
| 3 | Pagar | Banda con **💵 La cuota · 320.000** y **💳 Todo lo que debes · 47.748.000** | Toca "La cuota" | 1 |
| 4 | Pagar | "¿Qué deuda pagas?": el hipotecario (la de su último pago) | Nada (2 si es otra) | 0 |
| 5 | Pagar | "¿Desde qué cuenta?": la de su último pago | Nada | 0 |
| 6 | Pagar | Pie: "💳 Pagas 320.000 de Crédito hipotecario desde Cuenta corriente · hoy. Te quedan 47.428.000 por pagar." | "💳 Pagar" | 1 |

*El dividendo de todos los meses:* en el mismo formulario, 🔁 Se repite →
Cada mes (+2 la primera vez); después, "✅ Sí" en los avisos del Inicio
(1 toque al mes, M5).
**Conteo objetivo:** cada pago **4 toques y 0 campos** (antes 5 + monto,
entrando por el detalle de la deuda); con "Se repite", 1 toque al mes.

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

**Objetivo (aprobado por Juan, 2026-10-10: invitar siempre a mano, sin ruido)**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Hogar | 1 |
| 2 | Hogar | Solo en el hogar: "👥 Invita a quien vive contigo" bajo la cifra. Con más personas: Más del hogar › ➕ Invitar a alguien | 1 |
| 3 | Invitar a alguien | Escribe el correo | campo |
| 4 | Invitar a alguien | Enviar invitación | 1 |

**Aceptar:** sin hogar, Bienvenido muestra la invitación con
"✅ Unirme a [hogar]" y "No, gracias" (y "Me invitaron" desaparece mientras
haya una): 1 toque. Con hogar, sigue la fila 📩 del Hogar.
**Conteo:** invitar 2 pantallas · 3 toques · 1 campo; aceptar 1 pantalla ·
1 toque. Implementado en §17.

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
**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-6 (§6).

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | — | Toca "+" | 1 |
| 2 | Hoja "+" | — | Toca ➕ Agregar cuenta | 1 |
| 3 | Agregar | Seis tarjetas: 🏦 Cuenta · 🐷 Ahorro · 📈 Inversión · 🏠 Bien · 💳 Deuda · 🤝 Te deben | Toca 🏦 Cuenta | 1 |
| 4 | Agregar | **"¿De qué tipo?" en botones** (Cuenta corriente · Cuenta vista · Efectivo · ➕ Otro) con **Cuenta corriente ya elegida** (en Cuenta, Ahorro e Inversión el tipo no cambia nada, así que viene el primero) | Nada (1 si es otro) | 0 |
| 5 | Agregar | "¿Cómo se llama?" | Escribe "Falabella" | campo |
| 6 | Agregar | "¿Cuánto tiene hoy?" (en la banda) | Escribe el saldo | campo |
| 7 | Agregar | — | "🏦 Agregar cuenta" | 1 |
| 8 | ¿Qué compartes? | Lo de siempre (o "Ahora no") | Responde | 1 |

**Conteo objetivo:** **5 toques + 2 campos** (meta T2 ✅, antes 7 a 8).

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
**Objetivo (✅ aprobado por Juan, 2026-10-09; ✅ implementado y mergeado)** — F-6 (§6). Cupo y día de pago
quedan fuera: son datos nuevos del dominio (⬜ Juan decide si se abren como
gap aparte).

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1–2 | Inicio → Agregar | — | "+" · ➕ Agregar cuenta | 2 |
| 3 | Agregar | Las seis tarjetas | Toca 💳 Deuda | 1 |
| 4 | Agregar | **"¿De qué tipo?" en botones** (💳 Tarjeta de crédito · 🏡 Crédito hipotecario · Crédito de consumo · ➕ Otro), **sin nada elegido**: en una deuda el tipo sí cambia cosas (una tarjeta no pregunta "¿Es una deuda de verdad?" y se paga con "Pagar una deuda") | Toca 💳 Tarjeta de crédito | 1 |
| 5 | Agregar | "¿Cómo se llama?" | Escribe "Visa" | campo |
| 6 | Agregar | "¿Cuánto debes hoy?" | Escribe el monto | campo |
| 7 | Agregar | — | "💳 Agregar deuda" | 1 |
| 8 | ¿Qué compartes? | — | Responde | 1 |

**Conteo objetivo:** **6 toques + 2 campos** (meta T2 ✅, antes 8 a 9).

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
**Objetivo (✅ aprobado por Juan, 2026-10-09, con F-19; ✅ implementado y mergeado)** — F-6 y F-19 (§6).

*Agregar:* como C2 con 🏠 Bien y el tipo en botones (🏠 Propiedad ·
🚗 Vehículo · ➕ Otro, sin nada elegido); "📈 Cambia de valor" ya viene en Sí
para un bien. **6 toques + 2 campos** (antes ≈ 9).

*Cada año (F-19, opcional):*

| # | Dónde | Qué ve | Qué hace | Toques |
|---|-------|--------|----------|--------|
| 1 | Inicio | En los avisos: **"📈 ¿Cuánto vale hoy tu Auto?"** · "lo actualizaste hace 1 año" | Toca el aviso | 1 |
| 2 | Actualizar cuánto vale | El valor de hoy y la resta en vivo | Escribe el valor | campo |
| 3 | Actualizar cuánto vale | — | "📈 Guardar valor" | 1 |

Aparece para bienes e inversiones que "cambian de valor" y no se actualizan
hace más de un año. Necesita que la API diga la fecha del último cambio de
valor de cada cuenta (dato de solo lectura, sin migración; requiere deploy).
**Conteo objetivo cada año:** 2 toques + valor, y la app lo recuerda.

#### C4 — Cerré una cuenta

**Actual**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Inicio | En "Tus cuentas", toca la cuenta | 1 |
| 2 | Detalle | 📦 Desactivar | 1 |
| 3 | Confirmar | Escribe el motivo | campo |
| 4 | Confirmar | Desactivar | 1 |

**Conteo:** 3 pantallas · 3 toques · 1 campo. *(Corregido al verificar: el
motivo ya era opcional, así que son 3 toques y 0 campos. Con saldo no pedía
nada: la cuenta dejaba de sumar y esa plata desaparecía de "Tu plata" sin
aviso.)*

**Objetivo (aprobado por Juan, 2026-10-10)**

| # | Dónde | Qué ve / qué hace | Toques |
|---|-------|-------------------|--------|
| 1 | Inicio | En "Tus cuentas", la cuenta › Ver la cuenta | 1 |
| 2 | Detalle | **📦 Cerrar cuenta** (antes "Desactivar"; en una deuda "Cerrar deuda", en un bien "Ya no lo tengo") | 1 |
| 3 | Cerrar cuenta | Si tiene saldo: "💰 Todavía tiene 50.000 CLP. ¿Dónde quedó esa plata?" → 🔁 La pasé a otra cuenta (abre Moví plata con el monto y la cuenta de salida puestos; al volver ya está en cero) · 🚫 Ya no la tengo ("Los 50.000 CLP dejan de contar en tu plata"). En una deuda: 💳 La pagué · 🚫 Ya no la debo | 0 (sin saldo) · 1 |
| 4 | Cerrar cuenta | 📦 Cerrar cuenta | 1 |

**Conteo:** sin saldo, 3 pantallas · 3 toques · 0 campos. Con saldo que se
pasa a otra cuenta: +4 toques (pasarla, elegir la cuenta, anotar). Lo cerrado
se ve como "📦 Cerrada desde el …" y en "🗄️ Ver cerradas".

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

**Objetivo (aprobado por Juan, 2026-10-10)**

| # | Dónde | Qué hace | Toques |
|---|-------|----------|--------|
| 1 | Cualquier pestaña | Toca la pestaña Planificar | 1 |
| 2 | Planificar | "🧾 Ponte un presupuesto del mes" abre directo Nuevo presupuesto | 1 |
| 3 | Nuevo presupuesto | "¿Cuánto piensas gastar?" (Solo mío y Cada mes vienen elegidos) | campo |
| 4 | Nuevo presupuesto | Guardar | 1 |

**Conteo:** 2 pantallas · 3 toques · 1 campo. Implementado en §17.

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
| F-4 | **Personas como botones:** "¿De quién?" muestra a las personas con algo pendiente primero (máx. 4) y "➕ Otra persona", con una línea del saldo de la elegida ("💵 Tienes 30.000 de Noira"). | M8, M10 | −1 toque | ✅ en M8 y M10 (§13) |
| F-5 | **Pagar una deuda** (no solo tarjeta) en la hoja "+": la deuda y la cuenta de la última vez, y botones con "Todo lo que debes" y "La cuota"; el pie dice cuánto queda por pagar. Gasté ya no ofrece bienes ni "te deben" como cuenta de pago. | M6, H5 | −1 a −3 toques y 0 campos | ✅ en M6 y H5 (§11) |
| F-6 | **"¿De qué tipo?" en botones** al agregar; en Cuenta, Ahorro e Inversión viene elegido el primero (no cambia nada para el usuario); en Bien, Deuda y Te deben se elige (cambia lo que se pregunta y cómo se paga). | C1, C2, C3 | −1 a −2 toques | ✅ en C1–C3 (§15) |
| F-7 | **El motivo viene elegido** en correcciones y eliminaciones (la API lo sigue exigiendo, DDD §T y §U): "✏️ Me equivoqué al anotarlo" al editar, "🙅 No pasó" · "👯 Estaba repetido" al eliminar, "♻️ La volví a usar" al reactivar; "✍️ Otro" abre el campo. Cerrar una cuenta ya no lo pedía. | M12, M13, C4 | −1 campo | ✅ en M12 y M13 (§16) |
| F-8 | **El "+" para todo lo que se repite o viene:** "🔁 Se repite" muestra Cada mes · Cada año como botones, y una fecha futura en Gasté / Recibí / Moví plata deja el movimiento programado en vez de anotarlo. Programar en Planificar sigue existiendo. | M5, H3, P2 | −1 a −4 toques; una sola puerta | ✅ en M5, H3 y P2 (§9) |
| F-9 | **"¿A dónde va la plata?" en Moví plata:** 🙋 A otra cuenta mía · 👤 A [miembro] como botones antes de la cuenta; si el miembro no deja ver ninguna cuenta, se dice qué tiene que hacer en su teléfono. El pie recuerda que la transferencia se hace en el banco y que el otro no anota nada. | M4, M9, H3 | −1 toque; deja claro quién anota qué | ✅ en M4 (§12) |
| F-10 | **La cuenta de salida también se recuerda cuando el destino viene elegido** (Hogar › Para transferirles, Pagar una solicitud). | M4, M7 | −2 toques | ✅ en M4 y M7 (§12) |
| F-11 | **"¿De quién es?" como botones** con una línea que explica el elegido, y en "Con [miembro]", **"¿Ya te pasó su parte?"**: si ya la pasó, no se le pide nada y se muestra lo que transfirió. | M7, M8, M9, M10 | −1 toque; evita pedir dos veces | ✅ en M7 y M9 (§12) |
| F-12 | **La app anota; la plata se mueve en el banco:** "Transferir" pasa a "✅ Ya le transferí X", con "Primero transfiérele en tu banco; acá queda anotado." | M4, M7 | claridad | ✅ en M7 (§12) |
| F-13 | **El monto pendiente con una persona a un toque:** al elegir a alguien con algo pendiente, la banda ofrece "💵 Todo lo de [persona]" (Gasté, si tienes plata suya) o "💵 Lo que te debe" (Recibí, si te debe). | M8, M10 | −1 campo | ✅ en M8 y M10 (§13) |
| F-14 | **"¿De dónde sale esta plata?"** en palabras del usuario, en vez de "¿Te había pasado plata antes?": 🤝 La pongo yo · 💵 Es de [persona]; solo si dice que era suya se pregunta si la anotó. | M10 | claridad | ✅ en M10 (§13) |
| F-15 | **"¿Para qué meta?" en botones** en Ahorrar (hasta 4 en camino, con emoji; una sola viene elegida; "➕ Nueva meta" vuelve con la meta nueva elegida). | A1, A2, A6 | −1 toque | ✅ en A1, A2 y A6 (§14) |
| F-16 | **La cuenta de tu último ahorro para esa meta** viene elegida en "¿De dónde sale la plata?"; el pie recuerda que la plata se mueve en el banco. | A1, A2, A7 | −2 toques | ✅ en A1 y A2 (§14) |
| F-17 | **"No se mueve" dicho en el pie** cuando la plata queda en la misma cuenta. | A6 | claridad | ✅ en A6 (§14) |
| F-18 | **"¿Quién más puede ahorrar en ella?"** (antes "¿Quién más puede cambiarla? (opcional)") con todos los del hogar marcados al compartir; si a alguien no lo agregaron, la Meta se lo dice. | A7 | claridad; evita que la pareja no pueda aportar | ✅ en A7 (§14) |
| F-19 | **Recordar actualizar el valor:** un aviso en el Inicio para bienes e inversiones que cambian de valor y no se actualizan hace más de un año. Requiere un dato de solo lectura en la API. | C3, A4 | la app lo recuerda | ✅ en C3 (§15) |

## 7. Orden de trabajo

Frecuencia primero; los primeros fijan los patrones.

1. **M1, M2, M3** — el formulario base (F-1, F-2). Lo que se decida aquí
   cambia 15 escenarios. ✅ implementado y mergeado (§9).
2. **M5, H3, P2** — lo que se repite (F-3, F-8). ✅ implementado y mergeado (§10).
3. **M6, H5** — tarjetas y deudas (F-5). ✅ implementado y mergeado (§11).
4. **M4, M7, M9** — entre miembros del hogar (F-9 a F-12). ✅ implementado y mergeado (§12).
5. **M8, M10** — plata de otras personas (F-4, F-13, F-14). ✅ implementado y mergeado (§13).
6. **A1, A2, A5, A6, A7, A8, A3, A4** — metas y valor (F-15 a F-18; A3, A4, A5 y A8 se mantienen). ✅ implementado y mergeado (§14).
7. **C1, C2, C3** — agregar (F-6, F-19). ✅ implementado y mergeado (§15). C4 (cerrar) pasa al bloque 8, con F-7.
8. **M12, M13, C4, M11** — corregir, borrar, cerrar y monedas (F-7). ✅ implementado y mergeado (§16).
9. **H1, H2, H4, H6, P1** — consultas y configuración. ✅ implementado y mergeado (§17).

Cada escenario trabajado reemplaza su "Objetivo: por definir" con la tabla de
pasos aprobada, el conteo antes → después, la rama, la verificación y la
fecha.

## 8. Decisiones del frente

| # | Decisión | Estado |
|---|----------|--------|
| S3-1 | Se trabajan los 33 escenarios; los primeros fijan los patrones. | ✅ Juan, 2026-10-09 |
| S3-2 | Entra la estructura de los flujos (por defecto, orden, atajos); lo visual de G35 se mantiene. | ✅ Juan, 2026-10-09 |
| S3-3 | Meta: T1 en ≤ 4 toques + monto; T2 en ≤ 8. | ✅ Juan, 2026-10-09 |
| S3-4 | Patrones F-1 a F-8 (§6). F-1 y F-2 aprobados con M1–M3; F-3 y F-8 con M5, H3 y P2; F-5 con M6 y H5; F-9 a F-12 con M4, M7 y M9; F-4, F-13 y F-14 con M8 y M10; F-15 a F-18 con las metas; F-6 y F-19 con C1–C3; F-7 con M12 y M13. | ✅ F-1 a F-6 y F-8 a F-19 Juan, 2026-10-09; F-7 Juan, 2026-10-10 |
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

## 11. Implementación de M6 y H5 (rama `feat/G39-deudas`)

**Estado:** ✅ aprobado por Juan y mergeado a `main` (2026-10-09). Solo app
(sin cambios en la API).

- **Hoja "+"** (`hooks/useAnotar`): "💳 Pagar una deuda · Tarjeta, crédito o
  préstamo" reemplaza a "Pagar tarjeta". Aparece si hay una deuda activa que
  no sea un encargo de otra persona; con una sola, viene elegida.
- **Pagar** (`RegistrarMovimientoScreen`, modo pago; también desde "💳 Pagar"
  del detalle de una deuda):
  - Orden: monto → "¿Qué deuda pagas?" (solo deudas, con "Debes X") →
    "¿Desde qué cuenta?" (solo cuentas, ahorro e inversiones).
  - La deuda y la cuenta de tu último pago vienen elegidas (cada una solo si
    falta), con "🔁 La de tu último pago. Tócala para cambiarla.".
  - En la banda, "💳 Todo lo que debes · X" y "💵 La cuota · Y" (si la deuda
    tiene cuota) llenan el monto de un toque. Los Frecuentes se limitan a los
    que pagan una deuda.
  - Pie: "💳 Pagas X de [deuda] desde [cuenta] · hoy. Te quedan Z por
    pagar." (o "⚠️ Es más de lo que debes"). Botón "💳 Pagar".
- **Gasté:** "¿Desde qué cuenta pagaste?" ofrece Cuentas, Ahorro, Inversiones
  y "💳 Tarjetas y créditos" (con "Debes X"); salen los bienes, lo que te
  deben y los encargos.
- **Verificado:** `tsc` sin errores; capturas web como Demo de la hoja "+",
  Pagar vacío y con "La cuota" (420.000 del hipotecario: "Te quedan
  47.328.000 por pagar", cuadra con 47.748.000 − 420.000) y la lista de
  cuentas de Gasté. No se anotó nada nuevo.
- **Conteo logrado:** pagar una deuda 4 toques, sin escribir · compra con
  tarjeta 4 + monto (si la tarjeta fue la última cuenta).

## 12. Implementación de M4, M7 y M9 (rama `feat/G39-hogar`)

**Estado:** ✅ aprobado por Juan y mergeado a `main` (2026-10-09). Solo app
(sin cambios en la API ni en el dominio).

- **F-9 · "¿A dónde va la plata?"** (Moví plata, si hay otros miembros):
  🙋 A otra cuenta mía · 👤 A [miembro], antes de la cuenta. Con un miembro,
  "¿A qué cuenta de [miembro]?" lista solo sus cuentas (una sola viene
  elegida); si no deja ver ninguna: "🔒 [miembro] todavía no te deja ver sus
  cuentas. Pídele que, en su teléfono, abra su cuenta › ⚙️ Ajustes de la
  cuenta › 👥 Con el hogar.". Después, "¿Desde qué cuenta?". Pie: "🔁 Le pasas
  X a [miembro] ([cuenta]) desde [cuenta] · hoy. Hazla en tu banco; acá solo
  queda anotada. [miembro] no tiene que anotar nada."
- **F-10 · la cuenta de salida se recuerda con el destino ya elegido:** desde
  Hogar › Para transferirles ("🔁 La de tu última transferencia") y en Pagar
  una solicitud (la cuenta de tu última transferencia, si tienes más de una).
- **F-11 · "¿De quién es?" en botones** (Gasté y Recibí), con una línea que
  explica el elegido ("🙋 Lo pagaste tú y es tuyo", "👫 Pagaste algo de los
  dos y Pareja te transfiere su parte"…). En "👫 Con [miembro]":
  "¿[miembro] ya te pasó su parte?" ⏳ No, que me la pase (elegido) · ✅ Sí,
  ya me la pasó. Con "Sí": se listan sus transferencias de los últimos 30
  días, "¿Cuánto era de [miembro]?", no se pregunta a qué cuenta te
  transfiere, se anota un gasto normal (sin solicitud) con el detalle
  "[miembro] puso X" si no escribiste otro, y el pie dice "… ya te pasó sus
  X: no le pedimos nada.". Con "No", como antes, y el pie dice "Le pedimos a
  [miembro] sus X: le llega un aviso para transferirte a [cuenta]."
- **F-12 · Pagar:** "✅ Ya le transferí X" (antes "Transferir X") y la línea
  "🏦 Primero transfiérele en tu banco; acá queda anotado.".
- **Verificado:** `tsc` sin errores; capturas web como Demo (Moví plata a
  Pareja, Gasté "Con Pareja" con No y con Sí) y como Pareja (Inicio con el
  aviso "Demo te pide tu parte: 15.000" → Pagar con la cuenta recordada y el
  botón nuevo). Para eso se anotó, como Demo, un gasto compartido de 30.000
  con Pareja (queda en la base local, con su solicitud de 15.000 pendiente
  para probar en el teléfono).
- **Conteo logrado:** M4 desde el "+" 4 + monto (3 si la última vez fue a la
  pareja) · M7 quien pagó 5 + monto, la pareja 2 · M9 Zoily 5 + monto.

## 13. Implementación de M8 y M10 (rama `feat/G39-personas`)

**Estado:** ✅ aprobado por Juan y mergeado a `main` (2026-10-09). Solo app
(sin cambios en la API ni en el dominio).

- **Pasos libres** (`contadorPasos`, pieza común): una pregunta `libre` no se
  bloquea aunque falte una anterior. Se usa en "¿De quién es?" y "¿De
  quién?", para elegir a la persona antes del monto (el monto puede salir de
  ella, F-13). Los demás pasos siguen la regla de HZ-24.
- **F-4 · "¿De quién?" en botones:** hasta 4 personas, primero las que tienen
  algo pendiente (`personasPrimero`), "➕ Otra persona" (pide el nombre) y
  "🔍 Ver todas (N)" si hay más. Debajo, el saldo en palabras
  (`saldoClaro`): "💵 Tienes 80.000 CLP de Nico", "🤝 Papás te debe 25.000",
  "👌 … y tú quedan a mano".
- **F-13 · el monto pendiente a un toque:** en la banda, "💵 Todo lo de
  [persona] · X" (Gasté, si tienes plata suya) o "💵 Lo que te debe · X"
  (Recibí, si te debe). Con el monto vacío, la línea del saldo dice "Para
  usar todo, toca «💵 Todo lo de Nico» arriba.".
- **F-14 · "¿De dónde sale esta plata?"** (Gasté, persona sin nada
  pendiente): "🤝 La pongo yo: [persona] me la devuelve" · "💵 Es de
  [persona]: me la había pasado"; con la segunda, "¿La anotaste cuando te
  llegó?" No la anoté · Sí, como ingreso mío (y elige cuál). Guarda lo mismo
  que antes (DEVOLVER / NO_ANOTADA / ANOTADA).
- **Pie:** "No es gasto tuyo: Papás te debe 25.000." / "… tienes 30.000 de
  Noira." / "… Nico y tú quedan a mano."; si falta algo, dice qué ("Completa
  el monto y de quién es.").
- **Verificado:** `tsc` sin errores; tests de `personas` y `recientes` 12/12;
  capturas web como Demo: "De otra persona" se toca antes del monto; Nico (80.000
  suyos) con su línea y "Todo lo de Nico" → "Nico y tú quedan a mano"; una
  persona nueva con "¿De dónde sale esta plata?" en sus dos ramas. No se
  anotó nada.
- **Conteo logrado:** compra para Noira 6 toques sin escribir · devolución de
  Papás 6 sin escribir · compra para Papás 6 + monto + nombre.

## 14. Implementación de metas y ahorro: A1, A2, A6, A7 (rama `feat/G39-metas`)

**Estado:** ✅ aprobado por Juan y mergeado a `main` (2026-10-09). Solo app
(sin cambios en la API ni en el dominio). A3, A4, A5 y A8 se mantienen.

- **F-15 · "¿Para qué meta?" en botones** (`AhorrarScreen`): hasta 4 metas en
  camino con su emoji, "🔍 Ver todas (N)" si hay más y "➕ Nueva meta". Con
  una sola, viene elegida. Ahorrar se recarga al volver: la meta recién
  creada (desde "➕ Nueva meta" o "🎯 Crear una meta", si no había ninguna)
  queda elegida.
- **F-16 · la cuenta de tu último ahorro para esa meta:** si la meta ya tiene
  cuenta y en los últimos 90 días hubo una transferencia hacia ella, esa
  cuenta de origen viene elegida, con "🔁 La de tu último ahorro para esta
  meta. Tócala para cambiarla.". Si no, se elige como antes. Pie con
  movimiento: "🔁 Se mueven X de A a B. Hazlo también en tu banco; acá queda
  anotado."
- **F-17 · sin movimiento:** "🐷 La plata se queda en [cuenta], separada para
  [meta]: no se mueve."
- **F-18 · "¿Quién más puede ahorrar en ella?"** (`MetaFormScreen`): al crear
  una meta compartida aparecen los del hogar, todos marcados (se pueden
  quitar), y después de crearla se guardan (`DefinirDesignadosObjetivo`); al
  editar, la misma pregunta. En la Meta, quien no fue agregado ve "👀 Meta del
  hogar: puedes verla, pero no te agregaron para ahorrar en ella. Pídele a
  quien la creó que te agregue en ✏️ Editar.".
- **Verificado:** `tsc` sin errores; capturas web como Demo: metas en botones;
  "Fondo de emergencia" (su cuenta, Cuenta de ahorro, no recibió transferencias
  en 90 días: no se preelige nada, como corresponde); "➕ Nueva meta"
  compartida "Prueba G39 vacaciones" con Pareja marcada → vuelve a Ahorrar con
  ella elegida → Cuenta corriente y 300.000 → pie "no se mueve" (no se
  guardó el ahorro). Como Pareja, "Prueba G39 vacaciones" aparece en Ahorrar
  (puede aportar). La meta queda en la base local.

## 15. Implementación de C1, C2 y C3 (rama `feat/G39-agregar`)

**Estado:** ✅ aprobado por Juan y mergeado a `main` (2026-10-09). **Incluye
un dato nuevo de solo lectura en la API (requiere deploy en Render).**

- **F-6 · "¿De qué tipo?" en botones** (`AgregarElementoScreen`): los tipos de
  lo elegido con su emoji (hasta 5; "🔍 Ver todos (N)" si hay más) y "➕ Otro"
  (crea un tipo nuevo). En 🏦 Cuenta, 🐷 Ahorro y 📈 Inversión viene elegido el
  primero de la lista; en 🏠 Bien, 💳 Deuda y 🤝 Te deben no viene ninguno.
- **F-19 · aviso anual:**
  - API: cada cuenta trae `fechaUltimaValorizacion` (la última valorización
    vigente, solo si admite valorización y quien pregunta ve el valor;
    `elemento.service`, `elemento.dto`). Sin migración. e2e de valorización
    6/6 con una aserción nueva.
  - App (`DashboardScreen`): en los avisos del Inicio, "📈 ¿Cuánto vale hoy tu
    [bien]?" con "Lo actualizaste hace N años" (o "No lo actualizas desde que
    lo agregaste") para bienes e inversiones activos que cambian de valor y no
    se actualizan hace más de un año. Tocarlo abre "Actualizar cuánto vale".
- **Verificado:** `tsc` sin errores (app y `src` de la API); capturas web como
  Demo: el aviso del Departamento (última valorización 3 oct 2025) → abre
  "Actualizar cuánto vale"; Agregar › Cuenta con "Cuenta corriente" elegida y
  Agregar › Deuda sin tipo elegido. No se guardó nada.
- **Conteo logrado:** C1 5 toques + 2 campos · C2 6 + 2 · C3 6 + 2 y, cada año,
  2 + valor desde el aviso.

## 16. Implementación de M12, M13, C4 y M11 (rama `feat/G39-corregir`)

**Estado:** ✅ aprobado por Juan y mergeado a `main` (2026-10-10). **Toca la API (requiere deploy en Render), sin
migración.**

**Decisiones de Juan (2026-10-10):** F-7 con el motivo elegido por defecto
(no se toca el dominio); M11 con "¿Cuánto llegó?" (cambio en la API);
"Desactivar" pasa a "Cerrar cuenta" ("Ya no lo tengo" en bienes).

- **API:**
  - `RegistrarEventoFinanciero` acepta `montoDestino` opcional, solo en
    `CONVERSION`: lo que llegó a la cuenta destino manda sobre la tasa
    vigente (la tasa queda implícita). En otro tipo responde 400.
  - `GET /tipos-cambio/tasa?origen&destino&fecha` (nuevo, solo lectura): la
    tasa que usaría la conversión (directa, inversa o triangulada), o `null`.
  - `GET /eventos-financieros/:id` trae `vigente` (monto, fecha, detalle y la
    cadena de correcciones) cuando el movimiento tiene correcciones vivas,
    igual que la fila de la lista. Antes el detalle mostraba el monto original
    y "Editar" fallaba al abrirlo desde la lista.
  - e2e: `tipo-cambio-conversion` 9/9 y `correccion-fecha-glosa` +
    `flujo6-correccion` verdes, con aserciones nuevas.
- **App:**
  - `AccionFormScreen`: `ElegirMotivo` (motivos a un toque, el primero
    elegido, "✍️ Otro" abre el campo) y `cierre` (el saldo de la cuenta o
    deuda, recargado al volver, con "La pasé a otra cuenta" / "La pagué" o "Ya
    no la tengo" / "Ya no la debo" antes de cerrar).
  - `CorregirMovimientoScreen`: el motivo elegido y "🔁 Anotar de nuevo"
    (también cuando ya se cambió o es un cambio de moneda; sin nada que guardar
    no hay botón Guardar).
  - `MovimientoDetalleScreen`: muestra lo vigente y "✏️ Lo cambiaste: antes
    era …" (solo lo que cambió); motivos de Eliminar.
  - `RegistrarMovimientoScreen`: acepta el formulario lleno (`monto`, `fecha`,
    `categoriaId`, `glosa`, `montoDestino`) y `reemplaza` ("¿Qué fue?",
    frecuentes ocultos, el pie lo dice; al anotar elimina el anterior y vuelve
    3 pantallas). En un cambio de moneda, el paso "¿Cuántos USD llegaron?".
  - `ElementoDetalleScreen` y `PatrimonioSeccionScreen`: Cerrar cuenta / Cerrar
    deuda / Ya no lo tengo; "Cerrada" y "Ver cerradas".
- **Verificado (capturas web, como Demo):** M12 (12.000 con el motivo elegido;
  detalle con lo vigente; Editar de uno ya cambiado solo ofrece Anotar de
  nuevo; anotarlo como 💰 Recibí elimina el gasto y su cambio, confirmado en
  la API); M13 (los tres motivos y Otro); C4 (Prueba G39 cerrar con 50.000 →
  La pasé a otra cuenta → Cuenta de ahorro → cerrar sin saldo → "📦 Cerrada");
  M11 (100.000 CLP → 104,17 USD al 960; escrito 102,5 → la cuenta en dólares
  queda en 2.602,5).
- **Datos de prueba que quedaron (base local):** la cuenta "Prueba G39
  cerrar" (cerrada, con su saldo pasado a Cuenta de ahorro); el ingreso
  "Prueba G39 helado" eliminado; un cambio de 100.000 CLP → 102,5 USD.

## 17. Implementación de H1, H4, H6 y P1 (rama `feat/G39-hogar-consultas`)

**Estado:** ✅ aprobado por Juan y mergeado a `main` (2026-10-10). **Solo app**, sin cambios en la API. H2 se
mantiene.

**Decisiones de Juan (2026-10-10):** la vista "Qué compartes" con la línea
"suman N de M" en el Hogar; H2 sin cambios; invitar siempre a mano, cuidando
el ruido (se resolvió así: destacado solo cuando estás solo en el hogar; con
más personas, una fila en "Más del hogar").

- **`QueCompartesScreen` (nueva, "Qué compartes con [pareja]"):** tus
  cuentas activas (sin encargos) en "🏠 Suman a la plata del hogar" y
  "🙋 Solo tuyas", con su saldo y lo que ve el hogar en corto. Tocar abre la
  hoja de `opcionesNivel` y aplica `aplicarNivel` al instante (los mismos dos
  comandos de Ajustes de la cuenta). Se entra desde el Hogar (la línea bajo la
  cifra y Más del hogar) y desde Ajustes. Plantilla Ajustes (se guarda al tocar),
  agregada al mapa de `plantillas-pantalla-s01.html`.
- **`HogarScreen`:** "🔐 De lo tuyo suman N de M" bajo la cifra; "👥 Invita a
  quien vive contigo" si no hay nadie más; en Más del hogar, "🔐 Qué
  compartes" y "➕ Invitar a alguien" (con más personas). "Personas del
  hogar" pasa a "Nombre y quiénes están".
- **`GestionHogarScreen`:** `invitarAlHogar` (el formulario de invitar, ahora
  compartido con el Hogar).
- **`InvitacionesScreen` / `BienvenidaScreen`:** `TarjetaInvitacion` con
  "✅ Unirme a [hogar]"; Bienvenido muestra las invitaciones pendientes y
  esconde "Me invitaron" mientras haya una.
- **`PlanificarScreen`:** "🧾 Ponte un presupuesto del mes" abre
  `PresupuestoForm` directo.
- **Verificado (capturas web):** como Demo, el Hogar con "De lo tuyo suman 2
  de 7"; Qué compartes con los dos grupos; Cuenta en dólares a "Todo" pasa a
  "Suman" (3 de 7) y de vuelta a "Nada"; Más del hogar con las filas nuevas.
  Como nuevo.g35 (sin hogar), Bienvenido con "✅ Unirme a Casa Carrero Flores"
  (no se aceptó). **Sin captura:** la tarjeta de invitar con el hogar de una
  sola persona (no hay un usuario así en la base local) y la fila de P1 (Demo
  y Pareja tienen presupuesto vigente); P1 abre la misma pantalla que "Nuevo
  presupuesto" de la lista.
