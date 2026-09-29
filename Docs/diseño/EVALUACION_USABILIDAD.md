# Evaluación de usabilidad del flujo completo (GAPS G32)

Revisión heurística hecha el 2026-09-29 sobre el código de la app (`app/src`),
simulando a un usuario nuevo que no conoce el modelo de dominio. No se probó con
personas: esto es la primera pasada; una prueba con alguien nuevo sirve después
para validar las propuestas.

Método: (1) mapa de navegación sacado de las llamadas `nav.go()` reales,
(2) recorrido de los flujos 1–6 de [UX_FLOWS.md](UX_FLOWS.md) contando pasos,
(3) chequeo contra las 10 heurísticas de Nielsen (H1–H10).

---

## 1. Mapa de navegación actual

```
Registro/Login ─► Bienvenida ─► CrearHogar | Invitaciones ─► Tabs

Tabs
├─ Inicio ──► Notificaciones, Ajustes (engranaje, única entrada)
│            Primeros pasos: AgregarElemento, RegistrarMovimiento, Objetivos
│            Composición ─► PatrimonioSeccion ─► ElementoDetalle
│            Disponibilidad "Apartado" ─► Planificar
│            Accesos: Movimiento, Objetivos, Programados, Evolución
├─ Movimientos ─► MovimientoDetalle (sin salidas)
│                "Más": MovimientosProgramados ─► ProgramadoDetalle (sin salidas)
│                       Plantillas
├─ Planificar ─► Objetivos ─► ObjetivoDetalle ─► AsignacionDetalle (crear reserva)
│               Apartado ─► Asignaciones ─► AsignacionDetalle
│               Presupuestos ─► PresupuestoDetalle ─► PresupuestoRubros
└─ Hogar ─► GestionHogar, Invitaciones, HogarConsolidado, MovimientosHogar,
            ElementoDetalle, ObjetivoDetalle

ElementoDetalle ─► Valorizar, RegistrarAjuste, EditarElemento, Historial,
                   Movimiento/Valorización/Ajuste/Asignación (detalle)
Ajustes ─► Perfil, Notificaciones, Visualización, Categorías, Tipos de elemento,
           Etiquetas, Agrupaciones, Tipos de cambio
```

Entradas por pantalla (cuántas pantallas llevan a ella): la mayoría tiene 1.
Con una sola entrada y poco visible: **Ajustes** (solo el engranaje de Inicio),
**Perfil** (solo desde Ajustes), **Plantillas** (solo "Más" de Movimientos),
**Asignaciones** (solo Planificar), **EvolucionPatrimonio** (solo un atajo de
Inicio), **PatrimonioSeccion** (solo tocando la composición en Inicio).

## 2. Recorrido de tareas clave

| Flujo | Camino en la app | Pasos | Fricción |
|---|---|---|---|
| 1 · Día a día (registrar un gasto) | FAB ► Registrar movimiento | 2 + formulario | Baja. Bien resuelto (FAB en Inicio y Movimientos, plantillas). |
| 2 · Alta de hogar + miembro | Bienvenida ► Crear hogar ► Tabs ► Hogar ► Invitar | 5 | Media: tras crear el hogar se cae en Inicio vacío; invitar vive en otra tab. |
| 3 · Valorizar un inmueble | Inicio ► Composición ► Sección ► Elemento ► Valorizar | 5 | Alta: no hay una lista directa de "mis cuentas y bienes". |
| 4 · Pagar una deuda | FAB ► Registrar movimiento (elegir la deuda) | 2 + form | Media: el pago existe, pero desde el detalle de la deuda no hay "Registrar pago". |
| 5 · Objetivo con reserva | Planificar ► Objetivos ► Crear ► Detalle ► Crear asignación ► Asignación ► Crear reserva | 7 | **Muy alta**: tres conceptos (objetivo, asignación, reserva) para "guardar plata para una meta". |
| 6 · Corregir un movimiento | Movimientos ► Detalle ► Corregir | 3 | Baja. |

## 3. Hallazgos priorizados

Severidad: **A** = bloquea o confunde a casi todo usuario nuevo · **M** = fricción
frecuente · **B** = pulido.

| # | Sev. | Hallazgo | Heurística |
|---|---|---|---|
| H-01 | **A** | **"Reserva" significa dos cosas.** Es una categoría de elemento ("fondo de emergencia", en Agregar cuenta) y también la plata apartada para un objetivo (Crear reserva). Además el mismo concepto aparece como "Apartado", "Reservado", "Asignación" y "Reserva" según la pantalla. | H2 (lenguaje del usuario), H4 (consistencia) |
| H-02 | **A** | **Ahorrar para una meta cuesta 7 pasos y 3 conceptos** (objetivo → asignación → reserva). El usuario piensa "quiero apartar $X de mi cuenta para el pie"; la asignación es un detalle del modelo que la UI expone. | H2, H8 (minimalismo) |
| H-03 | **A** | **Las cuentas y bienes no tienen un hogar propio.** El elemento patrimonial es la entidad central, pero solo se llega a él tocando la composición de Inicio o desde Hogar. No hay "Mis cuentas" como lista. | H6 (reconocer antes que recordar) |
| H-04 | **A** | **Tras crear el hogar el usuario queda solo.** Bienvenida explica que "todo usuario debe pertenecer a un hogar" (lenguaje de sistema), y después cae en un Inicio vacío. "Primeros pasos" ayuda, pero no explica para qué sirve cada sección ni cómo se conectan. | H10 (ayuda), H2 |
| H-05 | **M** | **Pantallas de detalle sin salida.** MovimientoDetalle no lleva a la cuenta, a su categoría ni al presupuesto que consume; MovimientoProgramadoDetalle no lleva a la cuenta ni a los movimientos generados; PresupuestoDetalle no lleva a los movimientos que lo consumen. Es exactamente la falta de "conexión" que motivó G32. | H6, H3 (control y libertad) |
| H-06 | **M** | **Programados y Plantillas están en "Más" de Movimientos**, pero UX_FLOWS (Parte 3) los ubica en Planificar. Un movimiento programado es planificación; un usuario lo busca ahí. | H4, coherencia con el diseño |
| H-07 | **M** | **Desde el detalle de un elemento no se puede registrar un movimiento** (depósito, gasto, pago de deuda) con esa cuenta ya elegida. Hay Valorizar y Ajuste, que son lo menos frecuente. | H7 (flexibilidad y eficiencia) |
| H-08 | **M** | **Tres vistas de patrimonio parecidas**: Evolución de mi patrimonio, Patrimonio (sección) y Patrimonio del hogar, más el Hero de Inicio con Míos/Del hogar. No queda claro cuál mirar. | H8, H4 |
| H-09 | **B** | **Agregar cuenta pregunta dos veces lo mismo**: "Tipo" ya sugiere la categoría (bien), pero "¿Qué es?" aparece debajo como un segundo select, y parece otra pregunta. | H8, H5 (prevención de errores) |
| H-10 | **M** | **El botón "+" de Planificar dice "Nuevo objetivo" pero abre la lista** de objetivos, donde el formulario está al final. | H1 (visibilidad), H4 |
| H-11 | **B** | **Ajustes y Perfil solo se alcanzan desde el engranaje de Inicio.** Desde Movimientos, Planificar u Hogar no hay forma de llegar. | H6 |
| H-12 | **B** | **Icono de la tab Movimientos** es `stats-chart` (gráfico); sugiere reportes, no una lista de ingresos y gastos. | H2 |
| H-13 | **B** | **"Valorizar", "Ajuste patrimonial", "Asignación"** sin explicación en la pantalla. Un `Ayuda` corto, como el que ya tienen las categorías en Agregar cuenta, basta. | H10 |
| H-14 | **B** | **Tipos de cambio en Ajustes** aparecía como una tarea manual; con G21 ya se importan solos USD/EUR/UF, así que la pantalla puede decir de dónde salen y cuándo se actualizaron. | H1 |

Lo que ya está bien y conviene conservar: FAB para registrar desde Inicio y
Movimientos, "Primeros pasos" con tachado, estados vacíos con acción, alcance
Míos/Del hogar compartido, ayudas por categoría en Agregar cuenta, corrección y
anulación con motivo.

## 4. Propuesta de ajustes (antes de tocar pantallas)

Ordenada por impacto / costo. Cada punto indica los hallazgos que resuelve.

1. **Vocabulario único** (H-01, H-13) — *chico, alto impacto*.
   - Renombrar la categoría de elemento `RESERVA` a **"Ahorro / fondo de
     emergencia"** en la UI (el enum del dominio no cambia).
   - Para la plata apartada para metas, usar siempre **"Apartado"** en la UI
     ("Apartar dinero", "Apartado para Pie vivienda"). "Reserva" y "Asignación"
     quedan como términos internos.
   - Glosario corto en `labels.ts` y un `Ayuda` en Valorizar, Ajuste y Apartado.
2. **"Apartar para esta meta" en un solo paso** (H-02) — *mediano*.
   Desde ObjetivoDetalle: botón "Apartar dinero" → elegir cuenta + monto. La app
   crea la asignación por debajo si el objetivo no tiene una (o reutiliza la
   única que tenga). La pantalla de Asignaciones queda para usuarios avanzados.
3. **Conectar los detalles** (H-05, H-07) — *chico por pantalla*.
   - MovimientoDetalle: filas tocables a la cuenta, la categoría y (si aplica)
     el presupuesto vigente.
   - PresupuestoDetalle: por rubro, "Ver movimientos" → Movimientos filtrados.
   - ProgramadoDetalle: enlace a la cuenta.
   - ElementoDetalle: acción "Registrar movimiento" con la cuenta preseleccionada
     (y "Registrar pago" si es deuda).
4. **Lista "Mis cuentas y bienes"** (H-03, H-08) — *mediano*.
   Opción recomendada: que el Hero/Composición de Inicio lleve a una lista única
   de elementos agrupada por categoría (reusar PatrimonioSeccion sin filtro), con
   la evolución arriba. Así se fusionan PatrimonioSeccion y EvolucionPatrimonio
   en una sola pantalla "Mi patrimonio". Alternativa más cara: una 5.ª tab.
5. **Reubicar Programados y Plantillas en Planificar** (H-06), dejando en
   Movimientos solo el acceso a plantillas desde el formulario de registro.
6. **Onboarding con propósito** (H-04) — *chico*.
   - Bienvenida: "PatrimonIA organiza tu plata por hogar. Crea el tuyo (aunque
     vivas solo) o únete a uno con una invitación."
   - Tras crear el hogar, llevar directo a Agregar cuenta con un mensaje
     ("Empecemos por tu cuenta corriente") en vez de un Inicio vacío.
   - En "Primeros pasos", una línea de para qué sirve cada tab.
7. **Pulido** (H-09 a H-12, H-14): cuando el tipo sugiere la categoría,
   mostrarla resuelta ("Categoría: Liquidez · cambiar") en vez de un segundo
   select; el "+" de Planificar abre el formulario; engranaje en el
   encabezado de todas las tabs; icono `list-outline` o `swap-vertical-outline`
   para Movimientos; en Tipos de cambio mostrar la fuente y la fecha de la
   última importación.

**Siguiente paso sugerido**: implementar 1, 3, 6 y 7 (chicos, sin decisión de
modelo) en una tanda; decidir 2 y 4 (tocan el modelo de navegación) y validar
con una persona nueva después.

---

## 5. Estado de aplicación (2026-09-29)

Aplicados los 7 puntos, solo en la app (sin cambios de modelo ni migraciones).
Decisiones del usuario: punto 2 sí, punto 4 como pantalla "Mi patrimonio",
punto 5 sí.

| Punto | Qué quedó | Hallazgos |
|---|---|---|
| 1 · Vocabulario | Categoría `RESERVA` se muestra como "Ahorro / fondo de emergencia". La plata para metas es siempre "Apartado" (títulos, botones, auditoría, notificación `RESERVA_CONSUMIDA`). `GLOSARIO` en `labels.ts` alimenta las `Ayuda` de Apartado, Valorizar y Ajuste. | H-01, H-13 |
| 2 · Apartar en un paso | ObjetivoDetalle: "Apartar dinero" (cuenta + monto). Crea la asignación con el nombre del objetivo si no hay; si hay una la reutiliza; si hay varias pide la parte. Crear partes queda como opción secundaria. | H-02 |
| 3 · Detalles conectados | MovimientoDetalle: cuenta(s), categoría (→ Movimientos filtrados) y presupuesto del mes. PresupuestoDetalle: cada rubro → sus movimientos. ProgramadoDetalle: cuentas y movimiento generado. ElementoDetalle: "Registrar movimiento" / "Registrar pago" (deuda) / "Registrar cobro" (crédito) con la cuenta elegida. | H-05, H-07 |
| 4 · Mi patrimonio | `PatrimonioSeccion` sin categoría = todas las cuentas y bienes por categoría + evolución del último año; enlaza a Evolución para fechas puntuales. Se llega tocando el Hero, "Ver todo" en Composición o el acceso rápido. | H-03, H-08 |
| 5 · Programados en Planificar | Sección "Pagos y cobros futuros" en Planificar (programados con conteo de pendientes + plantillas). Movimientos pierde el menú "Más"; el formulario de registro enlaza a plantillas. | H-06 |
| 6 · Onboarding | Bienvenida explica el hogar en lenguaje de usuario. Tras crear el hogar se abre Agregar cuenta con un mensaje. "Primeros pasos" explica las 4 tabs. | H-04 |
| 7 · Pulido | Categoría resuelta desde el tipo ("Categoría: X · Cambiar"); "+" de Planificar abre el formulario arriba; engranaje en todas las tabs; icono `swap-vertical-outline` en Movimientos; Tipos de cambio muestra fuente y última importación. | H-09 a H-12, H-14 |

Pendiente: validar con una persona nueva (tareas: registrar un gasto, apartar
para una meta, encontrar una cuenta, pagar una deuda).
