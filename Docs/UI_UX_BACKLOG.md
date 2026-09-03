# Backlog de UI / UX

Revisión del cliente Expo tras la Fase 14 (navegación, sesión, tests, CI, 14c).
Recoge todo lo que **no está en el código hoy** y hace que la app se sienta sin
pulir. Basado en la revisión de las 26 pantallas, el esquema y los 6 documentos
de diseño, más las observaciones directas del usuario.

Las decisiones que tocan el **dominio** (campos nuevos, tablas nuevas) están
además en `GAPS.md` (G22–G25) con el formato de siempre — este documento es el
backlog operativo; `GAPS.md` es la fuente de verdad de la decisión de dominio.

## Cómo leer

- **Tipo**: 🔴 necesita backend / migración primero · 🟡 solo frontend
- **Prioridad**:
  - **P0** — hace sentir la app "rota" (el usuario lo reportó)
  - **P1** — funcionalidad esperada que falta
  - **P2** — pulido importante
  - **P3** — nice-to-have

---

## A. Frescura de datos y estado — **P0**

Hoy **ninguna** pantalla se actualiza sola: cada lista carga con
`useEffect(() => cargar(), [cargar])` una sola vez, y al volver de una pantalla
hija con `nav.back()` el padre no re-consulta. El usuario tiene que apretar el
link "Actualizar". (Esto causó que se crearan 2 cuentas demo: se guardó, no se
vio el elemento, se asumió que falló.)

| # | Item | Tipo | Prioridad | Estado |
|---|------|------|-----------|--------|
| A1 | Auto-refresh al enfocar una pantalla (`useFocusEffect`) en todas las listas | 🟡 | P0 | ✅ 15a — `useCargaAlEnfocar` en las 17 pantallas |
| A2 | Pull-to-refresh (`RefreshControl`) — reemplaza el link "Actualizar" | 🟡 | P0 | ✅ 15a — `Screen onRefresh=`; links "Actualizar" borrados |
| A3 | UI optimista: mostrar el ítem recién creado de inmediato (estado "guardando…") y confirmar/revertir | 🟡 | P0 | ⚠️ 15a parcial — con A1 el ítem aparece al volver sin apretar nada; el "mostrar antes de confirmar" queda para 15b |
| A4 | Store / caché con invalidación tras mutación (`@tanstack/react-query` o similar) — hoy cada pantalla re-pide todo | 🟡 | P1 | |
| A5 | `Idempotency-Key` en los `POST /comandos/*` de creación (el backend ya lo soporta, Fase 12) — evita duplicados por doble tap / reintento | 🟡 | P1 | ✅ 15a — `api.comando()` + `useIdempotencyKey` en Agregar elemento / Registrar movimiento / Crear hogar |
| A6 | Manejo de JWT expirado a mitad de sesión → redirigir a login, no error genérico por request | 🟡 | P1 | ✅ 15a — 401 en request autenticada → `cerrarSesion` |

---

## B. Controles de entrada — **P0 / P1**

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| B1 | **Date picker nativo** en todos los campos de fecha (hoy son texto libre `YYYY-MM-DD`): Presupuestos, Movimientos programados, Evolución, Tipos de cambio, Materializar | 🟡 | P0 |
| B2 | **Exponer el campo fecha** donde el comando lo acepta pero la UI lo fuerza a hoy: Registrar movimiento, Registrar ajuste, Valorizar (no puedes cargar un gasto de ayer) | 🟡 | P1 |
| B3 | **Input de monto con formato**: separador de miles en vivo, símbolo de moneda, decimales, teclado numérico correcto | 🟡 | P1 |
| B4 | ✅ 15k — componente `Select` (hoja modal con lista scrollable, opción "Otro…"); categoría funcional del elemento pasó de `Segmented` a `Select` | 🟡 | P1 |
| B5 | ✅ 15k — `tipo` de elemento = `Select` con presets (`TIPOS_ELEMENTO_SUGERIDOS` en `labels.ts`) + "Otro…" para texto libre; en Agregar y Editar elemento | 🟡 | P1 |
| B6 | ✅ 15k — `Select` de moneda (`MONEDAS_FRECUENTES` ISO 4217 + "Otro…") en Agregar elemento | 🟡 | P2 |
| B7 | **Buscador / filtro** en los pickers de elementos (Registrar movimiento lista *todos* como radios verticales; no escala > 6) | 🟡 | P2 |
| B8 | **UI de co-propietarios con %** — el backend soporta `propietarios[]` desde Fase 2; hoy solo se puede crear al 100 % propio | 🟡 | P2 |
| B9 | ✅ 15k — `Screen` envuelve el scroll en `KeyboardAvoidingView` (+ `keyboardDismissMode="interactive"`) | 🟡 | P1 |

---

## C. Categorización y detalle de movimientos — **P1** 🔴

> Ver el análisis completo en **§ "Categorización — categoría vs. etiqueta"** más abajo, y `GAPS.md` G22–G24.

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| C1 | **Glosa / detalle** en `evento_financiero` ("pago internet marzo") — migración + campo en el comando + UI | 🔴 | P1 |
| C2 | **Categorías de movimiento** (Mercado, Servicios, Sueldo…) — tabla + sección de administración + selector al registrar | 🔴 | P1 |
| C3 | ✅ 15d — `presupuesto_linea` (migr. 010, GAPS G26), comando `DefinirLineasPresupuesto`, `desviacion` con `porRubro` + `sinClasificar`, editor de rubros + barra de distribución en el detalle | 🔴 | P1 |
| C4 | ✅ 15h — `plantilla_movimiento` (migr. 011, GAPS G24) + comandos Crear/Actualizar/Eliminar + `GET /usuarios/me/plantillas-movimiento`; app: `PlantillasScreen` (CRUD), selector "Desde una plantilla" en "Registrar movimiento", "Guardar como plantilla" en el detalle del movimiento | 🔴 | P2 |
| C5 | ✅ 15i — `etiqueta` + `evento_etiqueta` (migr. 012, GAPS G23); comandos Crear/Actualizar/Eliminar/`EtiquetarEvento`; `RegistrarEventoFinanciero` acepta `etiquetaIds`, la corrección las hereda; app: `EtiquetasScreen`, chips al registrar y en el detalle del movimiento (`Chip` en `ui/`) | 🔴 | P3 |
| C6 | ✅ 15j — `agrupacion_elemento` + `agrupacion_miembro` (migr. 013, GAPS G23); comandos Crear/Actualizar/Eliminar/`DefinirElementosAgrupacion`; `GET /usuarios/me/agrupaciones`; app: `AgrupacionesScreen` (Ajustes → Cuenta) + la lista de "Elementos" del Inicio se agrupa por carpeta | 🔴 | P3 |

---

## D. Arquitectura de información y navegación — **P1 / P2**

Hoy el Dashboard es una lista de ~12 `LinkButton` apilados con el mismo peso
visual ("Notificaciones", "Tipos de cambio" y "Cerrar sesión" al mismo nivel).

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| D1 | ✅ 15e / refinado en Fase 16 — tabs **Inicio · Movimientos · Planificar · Hogar · Ajustes** (Movimientos = vista mensual/anual real; Planificar = ex-Objetivos + presupuestos/programados/plantillas) | 🟡 | P1 |
| D2 | ✅ 15e — **header nativo** (título + atrás) en las ~24 pantallas apiladas; se borraron los 38 `LinkButton "Volver"`; `Screen` detecta el header (`HeaderHeightContext`) y ajusta el padding superior | 🟡 | P1 |
| D3 | ✅ 15e — Dashboard queda con patrimonio + elementos + acciones; el resto se repartió en los hubs `MovimientosScreen` / `HogarScreen` y en `AjustesScreen` (con `MenuLink` / `GroupLabel`) | 🟡 | P1 |
| D4 | ✅ 18 — componente `FAB` + prop `<Screen fab={...}>` (botón fijo, despeja la barra de tabs); "+" para "Registrar movimiento" en Inicio y Movimientos | 🟡 | P2 |
| D5 | ✅ 15l — tocar una notificación abre la entidad (`OBJETIVO_FINANCIERO`→detalle, `ASIGNACION`→detalle, `INVITACION`→Invitaciones, `EVENTO_FINANCIERO`→detalle) | 🟡 | P2 |
| D6 | **Contexto / breadcrumb** en pantallas de detalle (a qué elemento/hogar pertenece lo que editas) | 🟡 | P2 |

---

## E. Feedback y estados — **P1 / P2**

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| E1 | **Toast / Snackbar de éxito** al guardar (hoy solo se vuelve atrás, sin confirmación) | 🟡 | P1 |
| E2 | **Diálogo de confirmación** para acciones destructivas (Eliminar elemento/hogar, Anular, Condonar, Cerrar sesión) | 🟡 | P1 |
| E3 | **Variante `danger` en `Button`** — hoy "Eliminar" usa el estilo `secondary` gris, igual que "Cancelar" | 🟡 | P1 |
| E4 | ✅ 15l — componente `EmptyState` (ícono + texto + acción opcional); en Dashboard (con botón), Objetivos, Presupuestos, Movimientos programados, Plantillas, Etiquetas, Agrupaciones, Notificaciones | 🟡 | P2 |
| E5 | **Skeleton loaders** en vez de un spinner centrado que tapa la pantalla | 🟡 | P2 |
| E6 | **Errores por campo** — hoy todo cae en un solo `ErrorText` al fondo (a veces un string multilínea del backend) | 🟡 | P2 |
| E7 | **Estado offline / sin backend** — mensaje claro + reintento | 🟡 | P2 |

---

## F. Localización y textos — **P1 / P2**

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| F1 | ✅ 15f — `src/labels.ts` (`etiqueta()` + `humanizar()` de fallback) traduce todos los enums del dominio; `Segmented` formatea las opciones por defecto; aplicado en las ~12 pantallas que mostraban valores crudos | 🟡 | P1 |
| F2 | ✅ 15f (parcial) — `fechaLegible()` ya estaba; `fechaRelativa()` ("hoy" / "ayer" / "hace 3 días") en las notificaciones. Falta extenderlo a más listas | 🟡 | P2 |
| F3 | ⚠️ 15k/18 parcial — `MoneyText` (rojo para negativos) en el valor destacado del detalle de elemento y en el patrimonio neto del Inicio. Falta: listas de movimientos, consolidado del hogar | 🟡 | P2 |
| F4 | **Copys menos técnicos** — "elemento patrimonial" → "cuenta / bien / deuda" para el usuario final | 🟡 | P2 |
| F5 | ✅ 17 — componente `Ayuda` (ícono info + texto sobre fondo azul tenue); reemplazó los `Paragraph`/`Text` explicativos en Objetivos, Asignación, Presupuestos, Categorías, Etiquetas, Agrupaciones, Plantillas, Movimientos programados | 🟡 | P2 |
| F6 | Infra de i18n (aunque sea es-CL única al inicio) para no tener strings hardcodeados por toda la app | 🟡 | P3 |

---

## G. Diseño visual — **P2 / P3**

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| G1 | ⚠️ 17 parcial — tokens `colors.fondo` / `colors.info` + `sombra`; el `Screen` va sobre gris suave y las tarjetas blancas resaltan (sweep de `styles.card` en 26 pantallas: `backgroundColor` + `borderRadius: 14`); componentes `Card` (con chevron "ver más" y `franja` de color) y `Chip` ya existen. Falta: escala tipográfica/espaciado, migrar todos los `styles.card` sueltos a `<Card>`, `ListItem`/`Stat` | 🟡 | P2 |
| G2 | **Iconografía** — cero iconos; categorías, tipos de movimiento y navegación se leen mucho mejor con iconos | 🟡 | P2 |
| G3 | ✅ 15g — `react-native-svg`; `src/ui/charts.tsx` con `Dona` (distribución + leyenda) y `GraficoLinea` (serie temporal). Dona en presupuesto por rubro y en "Patrimonio del hogar"; línea en "Evolución de mi patrimonio" (nuevo `GET /usuarios/me/serie-patrimonial`). Falta: avance de objetivos como gráfico | 🟡 | P2 |
| G4 | ✅ 15g — la tarjeta "Mi patrimonio" del Dashboard muestra neto grande + líquido + variación de 30 días (▲/▼, color) por moneda | 🟡 | P2 |
| G2 | ✅ 15g (parcial) — `@expo/vector-icons` (Ionicons) en la barra de tabs. Falta: iconos en `MenuLink`, categorías, listas | 🟡 | P2 |
| G5 | **Modo oscuro** | 🟡 | P3 |
| G6 | Contraste — `colors.muted` (#6b7280 sobre blanco) está al límite AA | 🟡 | P2 |

---

## H. Formularios y flujos — **P2**

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| H1 | **Wizard para "Agregar elemento"** — hoy un form largo con campos que aparecen/desaparecen según la categoría; mejor 2-3 pasos | 🟡 | P2 |
| H2 | **No perder lo escrito** al navegar atrás por accidente (confirmar descarte) | 🟡 | P2 |
| H3 | **Validación en vivo** (monto > 0, moneda coincide con el elemento) con mensajes junto al campo | 🟡 | P2 |
| H4 | **Transferencia a otro miembro del hogar** — hoy la UI dice "hay que conocer el id de su elemento"; debería listar los elementos visibles de co-miembros (cruza con G6) | 🟡 | P2 |
| H5 | ✅ 18 — `EditarElementoScreen` ya tenía visibilidad; se agregó "¿Cuenta en el patrimonio del hogar?" (`CambiarParticipacionEnConsolidacion`), ambos con caja `Ayuda` | 🟡 | P2 |

---

## I. Accesibilidad — **P2**

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| I1 | `accessibilityLabel` / `accessibilityRole` en Pressables; áreas de toque ≥ 44 px | 🟡 | P2 |
| I2 | Soporte de fuentes grandes del sistema (evitar tamaños fijos que rompen el layout) | 🟡 | P3 |

---

## J. Onboarding — **P2**

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| J1 | ✅ 15l — card "Primeros pasos" en el Dashboard (agregar cuenta → registrar movimiento → crear objetivo), cada paso navega y se tacha solo; se oculta al completar los 3 o con "Ocultar" (recordado en secure-store por usuario) | 🟡 | P2 |
| J2 | ✅ 18 — caja `Ayuda` bajo el selector de categoría funcional en "Agregar elemento", con el ejemplo del valor elegido (Liquidez / Reserva / Inversión / Activo / Deuda / Crédito) | 🟡 | P2 |

---

## Categorización — categoría vs. etiqueta (análisis de C)

Petición del usuario: *"evaluar cómo abordar — si es a través de una etiqueta
(con sección para crear etiquetas) o categoría (con sección para crear
categorías)"*.

### La distinción

| | **Categoría** | **Etiqueta** |
|---|---|---|
| Cardinalidad por movimiento | 0..1 | 0..N |
| Naturaleza | taxonomía excluyente ("este gasto **es** Mercado") | transversal, acumulativa ("#reembolsable #viaje-2026") |
| Jerarquía | sí (padre/hijo, típico 2 niveles: Servicios › Internet) | plana |
| Presupuesto | base natural del rubro | ambiguo — un gasto con 3 etiquetas ¿a qué presupuesto imputa? |
| Reportes | distribución del gasto sin doble conteo | slices ad-hoc, con solapamiento |
| Alcance típico | vocabulario compartido del hogar | personal |
| Ejemplos | Mercado, Transporte, Salud, Vivienda, Ocio, Sueldo, Arriendo | #reembolsable, #vacaciones-chile-2026, #regalo, #emergencia |

### Decisiones tomadas (sesión 2026-09-03)

- Categorías **del hogar**, **lista plana**, **siempre opcionales** en el evento.
- **Ambas** (categoría + etiqueta), pero solo la **categoría** entra en Fase 15c;
  etiquetas y agrupaciones de elementos son fases posteriores.

### Recomendación: **ambas, con roles distintos — la categoría es la columna vertebral**

1. **Categoría** (0..1, obligatoria-suave en el gasto): impulsa el presupuesto por
   rubro, la vista consolidada agrupada y los reportes de distribución.
   - Tabla `categoria_movimiento(id, hogar_id, nombre, tipo_aplicable
     ENUM(INGRESO, GASTO, AMBOS), categoria_padre_id NULL, color NULL, icono NULL,
     orden INT, estado ENUM(ACTIVA, ARCHIVADA), created_at)`.
   - `evento_financiero.categoria_id UUID NULL` FK.
   - **Del hogar** (para que la familia hable el mismo idioma), con un set inicial
     sembrado al crear el hogar y editable/archivable.
   - No se borra si tiene eventos → se **archiva**.
   - Comandos: `CrearCategoriaMovimiento`, `ActualizarCategoriaMovimiento`,
     `ArchivarCategoriaMovimiento`, `ReordenarCategoriasMovimiento`.
   - `RegistrarEventoFinanciero` / `CorregirEventoFinanciero` aceptan `categoriaId?`.

2. **Etiqueta** (0..N, opcional, personal): para cortes que no encajan en la
   taxonomía. Tabla `etiqueta` + `evento_etiqueta` (N:M). **Fase posterior.**

3. **Agrupación de elementos patrimoniales** — concepto **aparte** (REQUISITES §D:
   "Inversiones" agrupando Fintual / APV / Fondo Mutuo). Son carpetas de
   visualización para tus *cuentas y activos*, no para movimientos. Tabla
   `agrupacion_elemento` + pertenencia (N:M o 0..1). Personal. **Fase posterior.**
   No confundir con **Asignación** (Agregado H), que reserva *valor* con un
   propósito ("Vacaciones", "Matrícula") y ya existe.

### Presupuesto por categoría

- Tabla `presupuesto_linea(presupuesto_id, categoria_id, monto_esperado)`.
- `GET /presupuestos/:id/desviacion` devuelve también el desglose por rubro:
  esperado vs. Σ eventos de esa categoría en el período.
- Extiende G15 (que dejó "asignaciones esperadas" fuera del alcance).

### Glosa (independiente de la categoría)

- `evento_financiero.glosa TEXT NULL` — texto libre corto (≤ 140), "pago internet
  marzo". Complementa la categoría, no la sustituye.
- Es anotación, no hecho económico → no participa de la reconstrucción histórica
  (DDD Sección V).

### Chequeo de principios del dominio

Categorías, etiquetas, agrupaciones y glosa son **configuración / anotación**, no
hechos económicos. Su historial de cambios vive solo en `auditoria`
(DATABASE_DESIGN §125, Principio C). No participan de la reconstrucción de estado
(Sección V). Consistente con el modelo cerrado. ✅

---

## Sección de Ajustes / preferencias (petición del usuario)

*"Debe existir un apartado de config donde administrar de forma más granular lo
que se mostrará — campos, nombres, categorías, etiquetas, etc."*

### Qué ya existe

- `usuario.preferencias JSONB` **está en el esquema** (DATABASE_DESIGN §87) y
  `ActualizarDatosUsuario` (#44) **ya lo acepta** (reemplazo del objeto completo).
- DDD Sección B lista "Preferencias globales" como responsabilidad del Usuario.
- **Falta**: `toUsuarioDTO` / `GET /usuarios/me` **no devuelven** `preferencias`.
  Sin lectura, el cliente no puede mostrar ni respetar la config guardada.

### Propuesta

Pantalla **Ajustes** (tab inferior) con sub-secciones:

| Sub-sección | Qué administra | Dónde vive |
|---|---|---|
| Perfil | nombre | `usuario` (ya existe) |
| **Categorías de movimiento** | CRUD, color, icono, orden, archivar, jerarquía | tabla `categoria_movimiento` (del hogar) |
| Etiquetas | CRUD | tabla `etiqueta` (personal) — fase posterior |
| Agrupaciones de elementos | CRUD + asignar elementos | tabla `agrupacion_elemento` (personal) — fase posterior |
| **Preferencias de visualización** | formato de fecha, secciones visibles del dashboard, moneda de despliegue, densidad, tema | `usuario.preferencias` |
| Notificaciones | tipos on/off | `usuario.preferencias` o tabla `preferencia_notificacion` |
| Hogar | moneda de consolidación, nombre, miembros/roles | comandos existentes (#35, #36, #40, #41) |
| Tipos de elemento sugeridos | presets para el picker B5 | `hogar.configuracion` o hardcoded + `preferencias` |

### Decisión pendiente (`GAPS.md` G25)

- **Personal vs. hogar**: preferencias de visualización → usuario. Categorías,
  moneda de consolidación, tipos sugeridos → hogar (hoy `hogar` solo tiene
  `nombre` + `moneda_consolidacion`; haría falta `hogar.configuracion JSONB` o
  tablas normalizadas).
- **Forma del objeto `preferencias`**: definir un esquema conocido con defaults
  en el cliente, no un JSON libre.

---

## Plan por fases (propuesto)

| Fase | Contenido | Depende de |
|------|-----------|------------|
| ~~15a~~ ✅ | A1 (auto-refresh al enfocar), A2 (pull-to-refresh), A5 (Idempotency-Key en altas), A6 (401 → logout). A3 completo queda para 15b. | — |
| ~~15b~~ ✅ | B1 (`DateField`), B2 (campo fecha en Registrar movimiento/ajuste/Valorizar), B3 (`MoneyField`), E1 (`ToastProvider`/`useToast`), E2 (`confirmar()` en acciones destructivas), E3 (`Button variant="danger"`), + `fechaLegible()`. Pendiente de B: B4 selector dropdown, B5 `tipo` picker, B6 moneda, B7 buscador de elementos, B8 co-propietarios. | — |
| ~~15c~~ ✅ | C1 (glosa en `evento_financiero`), C2 (tabla `categoria_movimiento` del hogar + comandos Crear/Actualizar/Archivar/Reordenar + seed de 11 al crear hogar + selector al registrar), pantalla Ajustes → Categorías, `GET /usuarios/me` devuelve `preferencias`. Migración 009. Pendiente de C: C3 (presupuesto por rubro → 15d), C4/C5/C6 (plantillas, etiquetas, agrupaciones → 15h). | GAPS G22, G23, G25 |
| ~~15d~~ ✅ | 🔴 C3 — `presupuesto_linea` (migr. 010, GAPS G26) + `DefinirLineasPresupuesto` + `GET /presupuestos/:id/lineas` + `desviacion.porRubro`/`sinClasificar`; app: pantalla `PresupuestoRubros` (editor) + sección "Por rubro" con barra de distribución apilada (`BarraDistribucion`) en el detalle. La dona SVG real queda para 15g. | 15c |
| ~~15e~~ ✅ | D1 (tabs inferiores: Inicio·Movimientos·Objetivos·Hogar·Ajustes) + D2 (header nativo, sin `LinkButton "Volver"`) + D3 (jerarquía del dashboard: hubs `MovimientosScreen`/`HogarScreen`, `MenuLink`/`GroupLabel`). `@react-navigation/bottom-tabs`. Faltan de D: D4 (FAB), D5 (deep-link notificación), D6 (breadcrumb). | — |
| ~~15f~~ ✅ | F1 (`src/labels.ts` — `etiqueta()`/`humanizar()`, `Segmented` autoformatea, ~12 pantallas) + F2 parcial (`fechaRelativa()` en notificaciones). Pendiente: F3 (montos/deudas contables), G1 (design tokens completos), G2 (iconos reales — necesita `@expo/vector-icons`) → 15g. | 15e |
| ~~15g~~ ✅ | G3 (`react-native-svg` + `src/ui/charts.tsx`: `Dona`, `GraficoLinea`; aplicados en presupuesto por rubro, patrimonio del hogar, evolución + `GET /usuarios/me/serie-patrimonial`) + G4 (tarjeta resumen del Dashboard: neto + líquido + variación 30d) + G2 parcial (Ionicons en las tabs). Pendiente: F3 (montos contables), G1 (tokens completos), J1–J2 (onboarding), gráfico de avance de objetivos → 15h/más adelante. | 15c, 15d |
| ~~15h~~ ✅ | 🔴 C4 — `plantilla_movimiento` (migr. 011, GAPS G24), comandos Crear/Actualizar/Eliminar, `GET /usuarios/me/plantillas-movimiento`; app: `PlantillasScreen` + "Desde una plantilla" al registrar + "Guardar como plantilla" en el detalle. | 15c |
| ~~15i~~ ✅ | 🔴 C5 — `etiqueta` + `evento_etiqueta` (migr. 012, GAPS G23); comandos `CrearEtiqueta`/`ActualizarEtiqueta`/`EliminarEtiqueta`/`EtiquetarEvento`; `RegistrarEventoFinanciero.etiquetaIds`, la corrección las hereda; DTO de evento con `etiquetaIds`. App: `EtiquetasScreen` (Ajustes → Cuenta), componente `Chip`, chips al registrar y en el detalle. | 15c |
| ~~15j~~ ✅ | 🔴 C6 — `agrupacion_elemento` + `agrupacion_miembro` (migr. 013, GAPS G23, una carpeta por elemento); comandos `CrearAgrupacion`/`ActualizarAgrupacion`/`EliminarAgrupacion`/`DefinirElementosAgrupacion`; `GET /usuarios/me/agrupaciones`. App: `AgrupacionesScreen` (Ajustes → Cuenta), la lista "Elementos" del Dashboard se agrupa por carpeta con subtítulos + "Sin agrupar". **Bloque C del backlog cerrado.** | 15i |
| ~~15k~~ ✅ | Controles de entrada: componente `Select` (hoja modal + "Otro…") → B4 (categoría funcional), B5 (`tipo` de elemento con presets), B6 (moneda ISO); B9 (`KeyboardAvoidingView` en `Screen`); F3 parcial (`MoneyText` rojo/contable en el detalle de elemento). | — |
| ~~15l~~ ✅ | Pulido: iconos en `MenuLink` (G2, todos los hubs); `EmptyState` en las 8 listas principales (E4); deep-link desde notificaciones (D5); card "Primeros pasos" en el Dashboard (J1). | — |
| ~~16~~ ✅ | **Reportes financieros + reorg de tabs** (GAPS G27): backend `resumen-financiero` / `resumen-anual` (agrega los `evento_financiero` existentes, alcance mios/hogar); app: tab **Movimientos** = vista mensual/anual (‹ mes/año ›, dona de gastos por rubro, lista, barras anuales, toggle Míos/Hogar), nueva tab **Planificar**, Dashboard sin miembros/invitar, categorías del hogar → tab Hogar. `GraficoBarras` en `charts.tsx`. | 15 |
| ~~17~~ ✅ | **Sistema visual + ayuda contextual**: `colors.fondo` (página gris suave) + `colors.info` + `sombra`; sweep de `styles.card` (fondo blanco + `borderRadius: 14`) en 26 pantallas → las tarjetas resaltan; componente `Card` (chevron "ver más" + `franja` de color) usado en las listas de Objetivos/Presupuestos/Mov. programados; chevron en las filas tocables (Inicio, detalle de elemento, Movimientos); puntos de color por agrupación en el Inicio; componente `Ayuda` (F5) en 8 pantallas. | 16 |
| ~~18~~ ✅ | Acciones y explicaciones: `FAB` (D4) para "Registrar movimiento" en Inicio/Movimientos; H5 (toggle "cuenta en el patrimonio del hogar" en editar elemento); J2 (ayuda de categoría funcional al agregar); visibilidad con ayuda; F3 en el patrimonio neto del Inicio. Pendiente suelto: B7, B8, H1–H4, F3 completo, G1 (tipografía/espaciado), E5–E7, D6, gráfico de avance de objetivos. | 17 |

Cada fase se cierra con e2e/tsc/`expo export` en verde y su commit, como las
fases 0–14.
