# Lente del hogar — Sesión 04

**Ubicación en el repo:** `Docs/usabilidad/LENTE_HOGAR_S04.md`
**Fecha:** 2026-10-10 · **Línea base:** `main` en `7f9b0a8` (merge de G41–G43).

## 0. Objetivo del frente

La app conserva todo lo que tiene, pero mejor explicado y mostrado. Dos
preguntas deben poder responderse sin acertijos:

1. **¿Cómo va el mes?**
2. **¿Cómo va el patrimonio?**

Este archivo cubre el **Bloque 1 (el lente)**. Los bloques 2 (Inicio responde
las dos preguntas) y 3 (la historia del mes) se especifican después, en este
mismo archivo.

## 1. Diagnóstico (revisión del código en `7f9b0a8`)

- **El lente ya existe:** `ui/alcance.tsx` es un contexto global y
  persistente. Inicio y Movimientos lo comparten.
- **Planificar no lo obedece:**
  - Muestra el primer presupuesto vigente (`presus.find(p => p.vigente)`)
    sin mirar si es `INDIVIDUAL` o `FAMILIAR`.
  - Mezcla las metas personales con las del hogar, aunque cada meta trae
    `hogarId`.
- **La pestaña Hogar repite lo que Inicio ya muestra en "Del hogar":** la
  plata del hogar (Tienen / Deben), "Lo que suma al hogar" (≈ "Dónde está la
  plata del hogar") y las metas del hogar.
- **Ajustes → Hogar ya tiene** Personas del hogar, Qué compartes e
  Invitaciones.
- Lo único propio de la pestaña Hogar es: **"🤝 Entre [miembro] y tú"**,
  **"🔁 Para transferirles"** e **"Invitar"**.

## 2. Decisiones

| # | Decisión | Estado |
|---|----------|--------|
| L-1 | La app tiene un solo lente, "🙋 Lo mío · 🏠 Del hogar", en el mismo lugar arriba de Inicio, Movimientos y Planificar. Todo lo obedece. | ✅ Juan, 2026-10-10 |
| L-2 | La pestaña Hogar desaparece y se reparte su contenido. **No se pierde ninguna función.** | ✅ Juan, 2026-10-10 |
| L-3 | Planificar obedece al lente. En "Lo mío": metas personales (`hogarId === null`) y presupuesto `INDIVIDUAL` vigente. En "Del hogar": metas con `hogarId` del hogar activo y presupuesto `FAMILIAR` vigente de ese hogar. | ✅ Juan, 2026-10-10 |
| L-4 | Si el hogar activo tiene un solo miembro, el lente no se muestra y la app queda en "Lo mío". | ✅ Juan, 2026-10-10 |
| L-9 | En "Del hogar", las solicitudes pendientes entre miembros no van en las alertas de Inicio: ya encabezan "Entre ustedes". En "Lo mío" siguen como alerta. | ✅ Juan, 2026-10-10 |
| L-10 | "Ahorro sin meta" (Planificar) solo en "Lo mío": es plata personal. | ✅ Juan, 2026-10-10 |
| L-11 | La frase del lente en "Primeros pasos" ("Arriba eliges si ves lo tuyo o lo del hogar") solo aparece cuando hay lente. | ✅ Juan, 2026-10-10 |
| L-12 | Inicio obedece al lente igual que Planificar (L-3): en "Lo mío", "Tus metas" muestra solo metas personales (`hogarId === null`) y la alerta de presupuesto excedido usa el `INDIVIDUAL` vigente; en "Del hogar", el `FAMILIAR` del hogar activo. | ✅ Juan, 2026-10-10 |

## 3. Adónde va cada pieza de la pestaña Hogar

| Pieza | Destino |
|---|---|
| Plata del hogar (Tienen / Deben) | Ya está en el hero de Inicio "Del hogar" → se elimina de aquí |
| Lo que suma al hogar | Ya está en "Dónde está la plata del hogar" de Inicio → se elimina de aquí |
| Metas del hogar | Ya están en Inicio "Del hogar" y en Planificar "Del hogar" (L-3) → se elimina de aquí |
| 🤝 Entre [miembro] y tú | **Inicio "Del hogar"**, debajo de las alertas (reusar `cargarEntreMiembros` y `FilaEntreRow`) |
| 🔁 Para transferirles | **Inicio "Del hogar"**, como atajo "Transferirle a [miembro]" en la sección Atajos |
| Invita a quien vive contigo (hogar de 1 miembro) | **Inicio**, en el lugar del lente (L-4): una fila "👥 Invita a quien vive contigo" |
| Personas del hogar · Qué compartes · Invitaciones | Ya están en Ajustes → Hogar. Agregar "Invitar a alguien" ahí |
| De lo tuyo suman X de Y | Ajustes → Hogar, como subtítulo de "Qué compartes" |
| Movimientos del hogar | Ya es Movimientos en "Del hogar" → se elimina el acceso |

## 4. Instrucciones para Claude Code — Bloque 1

Trabajar en la rama `feat/L1-lente-hogar`. Seguir `CLAUDE.md`.

**Paso 0 — Verificar producción.** Sin cambios de código.
- Confirmar con Juan que la migración `029_hogar_dia_inicio_mes.sql` se
  corrió en Neon (el merge de G41–G43 ya está en `main` y Render despliega al
  hacer push).
- *Señal:* Inicio carga en producción sin error.
- *Si falla:* correr la migración 029 en Neon y reiniciar el servicio en
  Render.

**Paso 1 — Planificar obedece al lente (L-3).**
- En `PlanificarScreen`, usar `useAlcance()` y el hogar activo.
- Filtrar las metas por alcance y elegir el presupuesto vigente por `tipo` (y
  `hogarId` en "Del hogar").
- Poner el `PillToggle` "Lo mío / Del hogar" donde lo tienen Inicio y
  Movimientos.
- Textos según el alcance: "Tus metas" / "Metas del hogar", "Tu presupuesto
  de [mes]" / "Presupuesto del hogar de [mes]". El estado vacío del
  presupuesto en "Del hogar" abre `PresupuestoForm` con `tipo: 'FAMILIAR'`.
- *Señal:* con un presupuesto `INDIVIDUAL` y otro `FAMILIAR` vigentes,
  Planificar muestra uno distinto en cada lente. Una meta personal no aparece
  en "Del hogar". `tsc` sin errores.

**Paso 2 — Llevar "Entre ustedes" y "Transferirles" a Inicio "Del hogar".**
- En `DashboardScreen`, con `alcance === 'hogar'`, mostrar la sección
  `🤝 [entre.titulo]` debajo de las alertas (las 4 primeras filas y
  "Ver todo" → `EntreMiembros`).
- Si hay algo pendiente, la sección aparece primero. Si no hay filas, no se
  muestra.
- En Atajos, en "Del hogar", reemplazar "Tu plata" por "Transferirle a
  [miembro]" (→ `RegistrarMovimiento` con `tipo: 'TRANSFERENCIA'` y destino
  la primera cuenta de `paraTransferir`). Con más de un miembro, abre "Moví
  plata".
- *Señal:* captura de Inicio "Del hogar" con la solicitud de prueba de 15.000
  pendiente visible arriba.

**Paso 3 — Ajustes → Hogar completo.**
- En `AjustesScreen`, grupo Hogar: Personas del hogar · Qué compartes (con el
  subtítulo "De lo tuyo suman X de Y") · Invitar a alguien
  (`invitarAlHogar`) · Invitaciones (solo si hay).
- *Señal:* las cuatro filas abren su destino.

**Paso 4 — Quitar la pestaña Hogar y aplicar L-4.**
- `RootNavigator`: quitar `Tab.Screen name="Hogar"`. Quitar `'Hogar'` del
  tipo en `navigation/navigator.tsx`.
- `HogarScreen` se deja en el repo sin registrar en este paso (se borra en
  el Paso 6, cuando Juan lo apruebe).
- L-4: si el hogar activo tiene un solo miembro, no mostrar el
  `PillToggle` en Inicio, Movimientos ni Planificar, forzar `'mios'` y
  mostrar en Inicio la fila "👥 Invita a quien vive contigo".
- Actualizar el texto de "Primeros pasos" en Inicio: tres secciones (Inicio,
  Movimientos, Planificar) y "arriba eliges si ves lo tuyo o lo del hogar".
- *Señal:* la barra tiene 3 pestañas. `tsc` sin errores, tests de `app/src`
  verdes. Con el usuario Demo (2 miembros) se ve el lente; con un usuario
  nuevo sin pareja, no.

**Paso 5 — Documentación.**
- `FLUJOS_SIMPLES_S03.md`: reescribir la ruta de los escenarios que pasan por
  la pestaña Hogar (H1, H4, H6 y los de "entre miembros" M4, M7, M9).
- `MEJORA_VISUAL_S02.md` §3 (mapa de la app): 3 pestañas.
- `GAPS.md`: registrar este frente como G44, con referencia a este archivo.
- Agregar este archivo al índice de `Docs/README.md`.
- *Señal:* un commit de documentos sin cambios de código.

**Paso 6 — Prueba de Juan y merge.**
- Juan prueba en el teléfono los dos lentes en las tres pestañas.
- Con su aprobación: borrar `HogarScreen.tsx` (y lo que quede sin uso),
  merge a `main`, push.
- No hay migraciones: el despliegue de la API no cambia.

**Rollback:** todo vive en la rama. Después del merge, `git revert` del
commit de merge devuelve las 4 pestañas. No hay cambios de base de datos ni
de API.

---

## 5. Bloque 2 — Inicio responde las dos preguntas

### 5.1 Decisiones

| # | Decisión | Estado |
|---|----------|--------|
| L-5 | Inicio se ordena en dos bloques, uno por pregunta: **📅 El mes** y **🏦 El patrimonio**, en ese orden, en los dos lentes. | ✅ Juan, 2026-10-10 |
| L-6 | El titular del mes es **"Te queda de [mes]"** (lo que entró en el ciclo menos lo que salió, G41). Razón (Juan): el mes se vive con lo que entró ese mes; lo que sobra de meses anteriores se aparta, no se gasta. | ✅ Juan, 2026-10-10 |
| L-7 | "Puedes gastar hoy" sale de Inicio, porque suma lo que sobró de meses anteriores y contradice L-6. Pasa a Tu plata con el nombre **"Libre en tus cuentas"** (misma resta: disponible − guardado para metas − de otras personas). | ✅ Juan, 2026-10-10 |
| L-8 | Al empezar un ciclo nuevo, Inicio pregunta qué hacer con lo que sobró del anterior (el hábito de Juan, ahora dentro de la app). | ✅ Juan, 2026-10-10 |

### 5.2 Inicio, de arriba abajo

1. Saludo, campana, engranaje y lente.
2. Alertas (solo lo que pide algo).
3. 🤝 Entre ustedes (solo "Del hogar", Bloque 1).
4. **📅 El mes** — "Te queda de octubre" (o "Les queda", o "⚠️ Salió más de lo que entró"), la barra Entró / Salió y el rótulo del ciclo. Al tocar, abre Movimientos en Mes. En los primeros días del ciclo, debajo va la tarjeta de cierre (L-8).
5. **🏦 El patrimonio** — "Tu plata hoy" / "Plata del hogar", con la variación, Tienes / Debes y la línea de evolución (en "Lo mío"). Al tocar, abre Tu plata.
6. Tus cuentas / Dónde está la plata del hogar.
7. Metas.
8. Atajos.

### 5.3 Instrucciones para Claude Code — Bloque 2

> **Estado (2026-10-11):** pasos 1 a 4 hechos en `feat/L2-inicio-dos-preguntas`
> (creada desde `feat/compartir-dos-preguntas`, por H2 y S de G45). Ajuste por
> H2: en "Del hogar", la tarjeta del mes incluye "🏠 Entró / 🚪 Salió del hogar"
> dentro de "Les queda". Falta el paso 5 (prueba de Juan y merge).

Rama `feat/L2-inicio-dos-preguntas`, sobre `main` con el Bloque 1 mergeado.

**Paso 1 — Reordenar Inicio en dos bloques (L-5, L-6).**
- En `DashboardScreen`, la tarjeta del mes pasa arriba del hero, con
  "Te queda de [mes]" como cifra principal (tamaño de cifra de hero) y la
  barra Entró / Salió debajo.
- El hero queda como el bloque del patrimonio, con el título "🏦 Tu plata
  hoy" / "🏦 Plata del hogar". Se quita la resta `debajo` (Plata disponible
  − Guardado − De otras personas = Puedes gastar hoy).
- *Señal:* capturas de Inicio en "Lo mío" y "Del hogar", en claro y oscuro:
  primero el mes, después el patrimonio, sin "Puedes gastar hoy".

**Paso 2 — "Libre en tus cuentas" en Tu plata (L-7).**
- En `PatrimonioSeccionScreen` (sin categoría, alcance `mios`), mostrar
  arriba la resta que salió de Inicio, con la cifra final "✅ Libre en tus
  cuentas" y una nota corta: "Incluye lo que sobró de otros meses".
- En `AjustesVisualizacionScreen`, quitar la fila "Puedes gastar". La clave
  `dashboard.disponibilidad` se deja en `preferencias.tsx`, sin uso, para
  no romper preferencias guardadas.
- *Señal:* la resta aparece en Tu plata con los mismos números que tenía
  Inicio antes del cambio.

**Paso 3 — Tarjeta de cierre del ciclo (L-8).**
- Cuándo: en "Lo mío", durante los primeros 7 días del ciclo, si en el ciclo
  anterior Entró − Salió > 0 (misma `foto-mes` con la ventana del ciclo
  anterior).
- Qué dice: "📦 Te sobraron [X] de [mes anterior]. ¿Qué hacemos con eso?"
- Acciones:
  - **🐷 Apartar para una meta** → `Ahorrar` con el monto propuesto (si
    `Ahorrar` no recibe un monto por parámetro, agregarlo).
  - **🔁 Pasarlo a otra cuenta** → `RegistrarMovimiento` con
    `tipo: 'TRANSFERENCIA'` y el monto.
  - **Ya lo hice** → oculta la tarjeta.
- La tarjeta se oculta para ese ciclo apenas se toca cualquiera de las tres
  acciones: guardar `preferencias.visualizacion.mes.cierreVisto` con la
  clave del ciclo (`AAAA-MM`). Así no vuelve a aparecer aunque el monto se
  haya apartado como reserva (la plata sigue en la cuenta y la foto del mes
  anterior no cambia).
- "Del hogar": sin tarjeta de cierre en este bloque.
- *Señal:* con el reloj del ciclo en el día 2 y datos de prueba con sobrante
  en el ciclo anterior, la tarjeta aparece. Después de "Ya lo hice" no
  vuelve al recargar. Tests de la función que decide si mostrarla (ventana de
  7 días, sobrante > 0, ya vista).

**Paso 4 — Documentación.**
- `MEJORA_VISUAL_S02.md`, ficha del Inicio: el nuevo orden.
- `FLUJOS_SIMPLES_S03.md`: los escenarios que leen "Puedes gastar" (H1 y los
  de metas que lo citan) apuntan a Tu plata.
- `GAPS.md`, en G44: Bloque 2.
- *Señal:* un commit de documentos sin cambios de código.

**Paso 5 — Prueba de Juan y merge.** Sin migraciones ni cambios de API.

**Rollback:** `git revert` del merge devuelve el Inicio anterior. La
preferencia `cierreVisto` queda guardada sin efecto.