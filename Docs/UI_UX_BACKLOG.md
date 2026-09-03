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
| B4 | **Selector real** (dropdown / bottom-sheet) en vez de `Segmented` de 6+ opciones (categoría funcional queda ilegible en un teléfono, sin scroll) | 🟡 | P1 |
| B5 | **`tipo` de elemento como picker curado** + "Otro (especificar)". Hoy es texto libre y hay que escribir `cuenta_corriente` exacto. Presets: cuenta corriente, cuenta vista, cuenta ahorro, APV, fondo mutuo, depósito a plazo, efectivo, inmueble, vehículo, deuda, crédito por cobrar (REQUISITES §D — son ejemplos, no un enum del esquema) | 🟡 | P1 |
| B6 | **Selector de moneda** conocido (ISO 4217) en vez de campo de texto | 🟡 | P2 |
| B7 | **Buscador / filtro** en los pickers de elementos (Registrar movimiento lista *todos* como radios verticales; no escala > 6) | 🟡 | P2 |
| B8 | **UI de co-propietarios con %** — el backend soporta `propietarios[]` desde Fase 2; hoy solo se puede crear al 100 % propio | 🟡 | P2 |
| B9 | `KeyboardAvoidingView` — en forms largos el teclado tapa el botón de guardar | 🟡 | P1 |

---

## C. Categorización y detalle de movimientos — **P1** 🔴

> Ver el análisis completo en **§ "Categorización — categoría vs. etiqueta"** más abajo, y `GAPS.md` G22–G24.

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| C1 | **Glosa / detalle** en `evento_financiero` ("pago internet marzo") — migración + campo en el comando + UI | 🔴 | P1 |
| C2 | **Categorías de movimiento** (Mercado, Servicios, Sueldo…) — tabla + sección de administración + selector al registrar | 🔴 | P1 |
| C3 | **Presupuesto por categoría** — montos esperados por rubro, `desviacion_presupuestaria` por rubro (extiende G15) | 🔴 | P1 |
| C4 | **Plantillas / movimientos recurrentes** — registrar "el gasto de siempre" en 2 toques (depende de C1+C2) | 🔴 | P2 |
| C5 | **Etiquetas** (0..N por movimiento, transversales) — fase posterior | 🔴 | P3 |
| C6 | **Agrupaciones de elementos patrimoniales** (carpeta "Inversiones" para tus cuentas — REQUISITES §D) — fase posterior | 🔴 | P3 |

---

## D. Arquitectura de información y navegación — **P1 / P2**

Hoy el Dashboard es una lista de ~12 `LinkButton` apilados con el mismo peso
visual ("Notificaciones", "Tipos de cambio" y "Cerrar sesión" al mismo nivel).

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| D1 | **Barra de tabs inferior** (Inicio · Movimientos · Objetivos · Hogar · Ajustes) | 🟡 | P1 |
| D2 | **Header de navegación** nativo (título + atrás) en vez de `headerShown:false` + un `LinkButton "Volver"` al fondo de cada pantalla | 🟡 | P1 |
| D3 | **Jerarquía en el Dashboard**: acciones frecuentes arriba (registrar movimiento, ver patrimonio), config/avanzado bajo "Más" o en la tab Ajustes | 🟡 | P1 |
| D4 | **FAB "+"** global para "registrar movimiento" / "agregar elemento" | 🟡 | P2 |
| D5 | **Deep-link desde notificaciones** — tocar "Objetivo completado" abre ese objetivo (el DTO ya trae `entidadTipo`/`entidadId`, hoy no se usa) | 🟡 | P2 |
| D6 | **Contexto / breadcrumb** en pantallas de detalle (a qué elemento/hogar pertenece lo que editas) | 🟡 | P2 |

---

## E. Feedback y estados — **P1 / P2**

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| E1 | **Toast / Snackbar de éxito** al guardar (hoy solo se vuelve atrás, sin confirmación) | 🟡 | P1 |
| E2 | **Diálogo de confirmación** para acciones destructivas (Eliminar elemento/hogar, Anular, Condonar, Cerrar sesión) | 🟡 | P1 |
| E3 | **Variante `danger` en `Button`** — hoy "Eliminar" usa el estilo `secondary` gris, igual que "Cancelar" | 🟡 | P1 |
| E4 | **Estados vacíos con acción** — "Aún no tienes elementos" → botón "Agregar el primero" | 🟡 | P2 |
| E5 | **Skeleton loaders** en vez de un spinner centrado que tapa la pantalla | 🟡 | P2 |
| E6 | **Errores por campo** — hoy todo cae en un solo `ErrorText` al fondo (a veces un string multilínea del backend) | 🟡 | P2 |
| E7 | **Estado offline / sin backend** — mensaje claro + reintento | 🟡 | P2 |

---

## F. Localización y textos — **P1 / P2**

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| F1 | **Traducir/formatear los enums** mostrados en crudo: `LIQUIDEZ`, `EN_PROGRESO`, `ADMINISTRADOR`, `PENDIENTE`, `MATERIALIZADO`, `CONVERSION`, `cuenta_corriente` — el usuario ve SCREAMING_SNAKE_CASE | 🟡 | P1 |
| F2 | **Fechas legibles** — `2026-03-15` → "15 mar 2026" / "hace 3 días" | 🟡 | P2 |
| F3 | **Montos negativos / deudas** — `money()` antepone `-`; para deudas: color rojo + "debes" o paréntesis contables | 🟡 | P2 |
| F4 | **Copys menos técnicos** — "elemento patrimonial" → "cuenta / bien / deuda" para el usuario final | 🟡 | P2 |
| F5 | **Ayuda contextual** compacta en vez de `Paragraph` largos que explican el modelo de dominio en cada form | 🟡 | P2 |
| F6 | Infra de i18n (aunque sea es-CL única al inicio) para no tener strings hardcodeados por toda la app | 🟡 | P3 |

---

## G. Diseño visual — **P2 / P3**

| # | Item | Tipo | Prioridad |
|---|------|------|-----------|
| G1 | **Sistema de diseño** — hoy cada pantalla redefine `styles.card`, colores hardcodeados, sin escala tipográfica ni de espaciado. Tokens + componentes `Card`, `ListItem`, `Chip`, `Stat` | 🟡 | P2 |
| G2 | **Iconografía** — cero iconos; categorías, tipos de movimiento y navegación se leen mucho mejor con iconos | 🟡 | P2 |
| G3 | **Gráficos** — evolución patrimonial (línea), distribución del hogar (dona), avance de objetivos — hoy son tablas de números | 🟡 | P2 |
| G4 | **Tarjeta de resumen** arriba del Dashboard (patrimonio neto · líquido · variación del mes) en vez de filas sueltas | 🟡 | P2 |
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
| H5 | **Editar más campos del elemento** — `ActualizarDatosElemento` solo expone nombre y tipo; `CambiarVisibilidad` y `CambiarParticipacionConsolidacion` están enterrados | 🟡 | P2 |

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
| J1 | **Checklist de primer uso** tras crear el hogar ("agrega tu primera cuenta → registra un movimiento → crea un objetivo") | 🟡 | P2 |
| J2 | **Explicar categoría funcional** con ejemplos en el momento de elegir, no en un párrafo aparte | 🟡 | P2 |

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
| **15c** | 🔴 C1 (glosa) + C2 (categorías: tabla, comandos, seed, selector) + Ajustes → Categorías. Exponer `preferencias` en `GET /usuarios/me`. Migración 009 (+010) | GAPS G22, G23, G25 |
| **15d** | 🔴 C3 (presupuesto por categoría) + reportes de distribución por rubro (gráfico dona) | 15c |
| **15e** | D1–D3 (tabs, header nativo, jerarquía del dashboard) + Ajustes como tab | — |
| **15f** | F1–F3 (traducir enums, fechas legibles, montos) + G1–G2 (design tokens, iconos) | — |
| **15g** | G3–G4 (gráficos, tarjeta resumen) + J1–J2 (onboarding) | 15c, 15d |
| **15h** | 🔴 C4 (plantillas), C5 (etiquetas), C6 (agrupaciones) + B7, B8, H1–H5 | 15c |

Cada fase se cierra con e2e/tsc/`expo export` en verde y su commit, como las
fases 0–14.
