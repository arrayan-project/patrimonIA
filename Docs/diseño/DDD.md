# Domain-Driven Design — PatrimonIA

**Objetivo:** modelo de dominio completo — agregados, invariantes, catálogo
de comandos (§T) y reglas de auditoría (§U). Es la fuente de verdad de las
reglas de negocio: si el código y este documento no coinciden, manda este
documento (o se abre un gap en `GAPS.md` si la regla todavía no existe acá).

> **Migrado de `.docx` a Markdown el 2026-09-06** (el original está en `Docs/_baseline/`). Este `.md` es ahora la fuente de verdad; las decisiones posteriores a Fase 0 se integran aquí y se registran en `GAPS.md`.

*Documento vivo de modelado de dominio*

Existen tres capas conceptuales muy bien diferenciadas:

- Información primaria (fuente de verdad): entidades y hechos del negocio que representan la realidad económica.
- Información derivada: consolidaciones, métricas, indicadores y proyecciones calculadas exclusivamente desde la información primaria.
- Auditoría: evidencia de las acciones que modifican la información primaria, sin convertirse en fuente de verdad ni en historial de negocio.

## Principios "núcleo" del modelo

- La realidad económica es la fuente de verdad.
- La información derivada siempre puede reconstruirse desde la información primaria.
- El historial de negocio y la auditoría son conceptos distintos.
- La auditoría observa comandos del dominio, no entidades.
- Las correcciones buscan representar la realidad, no preservar errores.
- La aplicación registra la realidad económica, pero no es dueña de ella: no posee dinero, asignaciones ni patrimonio real. Todo eso existe fuera de la aplicación; el sistema solo lo registra, organiza y, eventualmente, lo consume.

# A. Agregado Hogar

### Entidad raíz

- Hogar

### Responsabilidades

- Gestión del hogar.
- Gestión de membresías.
- Gestión de roles.
- Gestión de invitaciones.

### Invariantes

- Debe existir al menos un administrador.
- No puede eliminarse el último administrador.

# B. Agregado Usuario

### Entidad raíz

- Usuario

### Responsabilidades

- Identidad.
- Autenticación.
- Preferencias globales.

### Observaciones

- Un usuario puede pertenecer a múltiples hogares.
- Un usuario no es equivalente a un miembro.

# C. Reglas de dominio confirmadas

### Propiedad patrimonial

- Todo elemento patrimonial debe tener al menos un propietario.
- El hogar nunca es propietario.
- La propiedad puede modificarse durante el ciclo de vida del elemento.

### Consolidación patrimonial

- Es independiente de la consolidación.
- Un elemento individual puede participar o no en la consolidación familiar.
- Participar en la consolidación no modifica la propiedad.

### Visibilidad

- Es independiente de la propiedad.
- Es independiente de la consolidación.

# D. Agregado Evento Financiero

### Entidad raíz

- Evento Financiero

### Entidades internas

- Impacto Patrimonial

### Responsabilidad

- Registrar hechos económicos.
- Generar impactos patrimoniales.

# E. Agregado Elemento Patrimonial

### Entidad raíz

- Elemento Patrimonial

### Responsabilidades

- Representar una unidad económica que afecta el patrimonio.
- Mantener propiedad y participación de miembros.
- Participar en consolidación patrimonial.
- Recibir impactos patrimoniales.
- Mantener su valor actual.
- Mantener su estado vigente, cuya evolución puede reconstruirse a partir del historial de hechos del negocio que lo afectan.

### Invariantes

- Debe tener al menos un propietario.
- El hogar no puede ser propietario de un elemento patrimonial.
- La propiedad es independiente de la consolidación.
- Un elemento patrimonial puede pertenecer a múltiples propietarios.
- Todo elemento patrimonial pertenece a al menos un propietario.

### Observaciones

- Existen elementos patrimoniales de naturaleza activa y pasiva.
- Las deudas se modelan como elementos patrimoniales.
- Los elementos patrimoniales pueden participar en métricas consolidadas del hogar sin perder su propiedad individual.

# F. Impacto Patrimonial

### Clasificación

- Entidad dependiente.

### Responsabilidades

- Representar el efecto producido sobre un elemento patrimonial específico.

### Reglas

- No puede existir sin una causa de origen.
- Puede originarse desde: Evento Financiero, Valorización, Ajuste Patrimonial.
- Si la causa desaparece, sus impactos asociados también desaparecen.

### Observaciones

- No es agregado.
- No es entidad raíz.
- No posee ciclo de vida independiente.

# G. Valorización

### Clasificación provisional

- Entidad interna del agregado Elemento Patrimonial.

### Responsabilidades

- Registrar cambios de valor económico sin movimiento financiero asociado.

### Reglas

- Debe quedar registrada históricamente.
- No constituye un movimiento financiero.
- Puede generar impactos patrimoniales.

### Observaciones

- Aplica principalmente a elementos valorizables.
- Su historial constituye un historial propio del dominio y representa la evolución económica del elemento patrimonial.
- El valor vigente de un elemento se reemplaza con cada valorización; no se acumula. El historial conserva los valores anteriores, pero el valor vigente es siempre el último registrado, no una suma.

# H. Agregado Asignación

### Entidad raíz

- Asignación

### Responsabilidades

- Representar un propósito financiero.
- Definir un monto objetivo.
- Mantener estado de financiamiento.
- Agrupar reservas asociadas.

### Invariantes

- Puede existir sin reservas.
- Puede contener múltiples reservas.
- Eliminar una asignación elimina el sentido de existencia de sus reservas.

### Observaciones

- Pertenece al ámbito de planificación financiera.
- No representa patrimonio.
- No representa movimientos financieros.

# I. Reserva

### Clasificación

- Entidad dependiente del agregado Asignación.

### Responsabilidades

- Representar cómo una asignación será financiada.

### Invariantes

- Debe pertenecer a una única asignación.
- No puede existir sin asignación.
- Una asignación puede contener múltiples reservas.

### Observaciones

- Una reserva representa una porción específica de financiamiento asociada a una asignación.
- Un mismo elemento patrimonial puede financiar múltiples reservas.
- La suma reservada no puede exceder la disponibilidad permitida por las fuentes utilizadas.

# J. Agregado Objetivo Financiero

### Entidad raíz

- Objetivo Financiero

### Responsabilidades

- Definir una meta financiera.
- Medir progreso.
- Agrupar una o más asignaciones relacionadas.

### Invariantes

- Puede existir sin asignaciones.
- No posee dinero.
- No modifica patrimonio.
- Su progreso se calcula desde las asignaciones asociadas.

# K. Agregado Presupuesto

### Entidad raíz

- Presupuesto

### Responsabilidades

- Representar expectativas financieras para un período o propósito determinado.
- Definir ingresos esperados.
- Definir gastos esperados.
- Definir ahorros esperados.
- Definir asignaciones esperadas.

### Observaciones

- Puede ser individual o familiar.
- Puede ser periódico o específico.
- No modifica patrimonio.
- No genera movimientos financieros.
- Puede existir sin elementos patrimoniales.
- Puede existir sin eventos financieros.
- Puede asociarse opcionalmente a objetivos financieros o propósitos específicos.

# L. Ajuste Patrimonial

### Propósito

- Corregir diferencias entre el patrimonio registrado y el patrimonio real.

### No reemplaza

- Evento Financiero.
- Valorización.

### Debe utilizarse cuando

- No existe información suficiente para reconstruir la causa exacta de una diferencia.
- Se requiere conciliación o regularización patrimonial.

### Observaciones

- Constituye un hecho del negocio y forma parte del historial patrimonial.
- Puede generar impactos patrimoniales.
- No debe utilizarse como mecanismo genérico para cualquier modificación patrimonial.

# M. Patrimonio Neto

### Clasificación

- Proyección calculada.

### Definición

- Resultado de la agregación de activos y pasivos del patrimonio.

### Observaciones

- No posee ciclo de vida propio.
- No se crea manualmente.
- No se persiste como entidad de negocio.
- Puede recalcularse a partir de los elementos patrimoniales.

# N. Métricas Patrimoniales

### Clasificación

- Proyecciones calculadas.

### Ejemplos

- Patrimonio Neto.
- Liquidez.
- Distribución patrimonial.
- Distribución por activos.
- Distribución por pasivos.
- Variación patrimonial.
- Avance de objetivos.
- Avance de asignaciones.
- Comparación presupuesto vs. ejecución real (desviaciones presupuestarias).

### Observaciones

- Son resultados derivados.
- No constituyen entidades del dominio.
- Se obtienen a partir de elementos patrimoniales, eventos financieros, asignaciones, objetivos y presupuestos.

# O. Proyecciones de Lectura

### Definición

- Vistas calculadas orientadas a consulta y análisis.

### Responsabilidades

- Presentar información consolidada.
- Facilitar métricas e indicadores.
- Optimizar consultas complejas.

### Observaciones

- No representan conceptos del dominio.
- No son agregados.
- No contienen reglas de negocio fundamentales.
- Pueden regenerarse a partir de los datos fuente.

# P. Principios transversales del dominio

### Principio 1 — Fuente de verdad

Toda información derivada debe poder reconstruirse íntegramente a partir de la información primaria vigente del dominio.

- Consolidaciones.
- Métricas.
- Dashboards.
- Proyecciones.
- Indicadores.

Nunca constituyen la fuente de verdad.

### Principio 2 — Separación entre estado y proyecciones

Las proyecciones representan resultados calculados a partir de la información primaria y nunca almacenan verdad propia.

Este principio refuerza y resume lo que ya se establece en Patrimonio Neto, Métricas, Proyecciones de Lectura y Consolidación.

### Principio 3 — La aplicación no es dueña de la realidad

La aplicación registra la realidad económica del usuario, pero no es dueña de ella: no posee dinero real, ni asignaciones reales, ni patrimonio real. Todo eso existe fuera del sistema. El sistema registra, organiza y eventualmente consume esa información, pero nunca la sustituye ni la posee.

### Principio 4 — Inferencia automática con control humano

Cuando el dominio puede inferir un cambio de estado a partir de información ya registrada (por ejemplo, completar un objetivo financiero o consumir una reserva), ese cambio se aplica automáticamente mediante una política del dominio, y se notifica al usuario como consecuencia. El usuario conserva siempre la capacidad de editar o revertir manualmente ese cambio ante una decisión repentina o un caso excepcional. Lo que el sistema puede inferir, se infiere; pero el usuario siempre tiene la última palabra.

# Q. Consolidación Patrimonial

### Clasificación

- Servicio de dominio y conjunto de proyecciones de lectura.
- No constituye una entidad.
- No constituye un agregado.
- No posee identidad ni ciclo de vida propio.

### Definición

- La consolidación patrimonial representa una vista agregada del patrimonio correspondiente a un hogar determinado.
- Su propósito es permitir análisis, métricas e indicadores sobre un perímetro familiar específico.
- La consolidación no crea, transforma ni elimina patrimonio.

### Reglas

- La consolidación se construye a partir de elementos patrimoniales existentes.
- La propiedad de un elemento patrimonial es independiente de su participación en la consolidación.
- Un elemento patrimonial no participa automáticamente en una consolidación por pertenecer a un miembro del hogar.
- La participación de un elemento patrimonial en la consolidación debe determinarse explícitamente.
- Un elemento patrimonial puede tener uno o múltiples propietarios.
- Un elemento patrimonial compartido existe una única vez dentro del sistema.
- Un elemento patrimonial puede aparecer simultáneamente en múltiples vistas individuales de sus propietarios.
- La aparición de un elemento en múltiples vistas individuales no constituye duplicación patrimonial.
- La consolidación nunca debe duplicar elementos patrimoniales compartidos.
- Un elemento patrimonial participa en una única consolidación de hogar.
- Un miembro puede pertenecer a múltiples hogares.
- Las consolidaciones de distintos hogares constituyen perímetros de análisis independientes.

### Relación con otros conceptos

- Las reservas no generan patrimonio adicional.
- Las asignaciones no generan patrimonio adicional.
- Los objetivos financieros no generan patrimonio adicional.
- Los presupuestos no generan patrimonio adicional.
- Por lo tanto, ninguno de estos conceptos incrementa el patrimonio consolidado.

### Responsabilidades

- Determinar qué elementos patrimoniales forman parte de una vista consolidada.
- Proveer la base para métricas patrimoniales.
- Proveer la base para indicadores financieros del hogar.
- Proveer la base para reportes y dashboards familiares.

### Proyecciones derivadas

A partir de la consolidación pueden calcularse:

- Patrimonio Neto.
- Liquidez.
- Distribución patrimonial.
- Distribución por activos.
- Distribución por pasivos.
- Variación patrimonial.
- Avance de objetivos.
- Indicadores y métricas del hogar.

# R. Regla transversal candidata

- Principio A: El estado vigente del dominio siempre debe representar la realidad económica.
- Principio B: La auditoría conserva evidencia de las modificaciones realizadas sobre el dominio, pero nunca reemplaza la representación de la realidad.
- Principio C: El historial del negocio y el historial de auditoría constituyen conceptos distintos.
  - Historial del negocio → evolución económica.
  - Auditoría → evidencia de cambios.
- Principio D: Toda operación derivada (consolidaciones, métricas, proyecciones e indicadores) debe obtenerse exclusivamente a partir de la información primaria vigente.
- Principio E: El usuario interactúa con PatrimonIA mediante comandos que expresan intenciones del negocio. El dominio ejecuta dichas intenciones y garantiza la consistencia de la información primaria mediante sus políticas internas. La auditoría registra los comandos ejecutados, mientras que toda información derivada se actualiza como consecuencia del nuevo estado del dominio.

# S. Pendiente

Modelo de dominio cerrado: catálogo completo de comandos por agregado (Sección T), Registro de Auditoría (Sección U), Reconstrucción histórica (Sección V), Políticas del dominio consolidadas (Sección W), y ciclo de vida completo de Objetivo Financiero y Presupuesto.

- ~~Revisar si Movimiento Programado requiere reglas de visibilidad/propiedad propias~~ → **resuelto: hereda las del elemento** (Sección X, más abajo — GAPS.md G2/P12).
- ~~Diseño de la base de datos~~ → `DATABASE_DESIGN.md` + `api/db/`.
- ~~Diseño de APIs y casos de uso~~ → `API_DESIGN.md` + `APPLICATION_SERVICES.md`.
- ~~Diseño UX/flujos de usuario~~ → `UX_FLOWS.md`.

Lo que sigue abierto (integraciones externas, decisiones menores y mejoras de
UX) está en `GAPS.md` → Parte 1 (Pendiente), con un resumen priorizado.

---

# T. Catálogo de comandos del dominio

Metodología aplicada: para cada agregado se identifican las intenciones reales que un usuario o el propio dominio pueden expresar sobre él, clasificadas en cuatro familias de comportamiento:

- Incorporar un hecho del negocio.
- Actualizar el estado de una entidad.
- Cambiar el ciclo de vida.
- Corregir la representación de la realidad.

Para cada comando se documentan las políticas del dominio que dispara y qué queda registrado en auditoría. Las políticas marcadas como tal (no como comando) se ejecutan automáticamente como consecuencia de otro comando; no son invocables directamente por el usuario.

### Patrón de corrección (Evento Financiero, Valorización, Ajuste Patrimonial)

Cuando un hecho económico ya registrado necesita corregirse, el dominio no reescribe el registro original. En su lugar, el comando de corrección genera una entrada compensatoria enlazada al original mediante una relación de corrección. El evento/valorización/ajuste original permanece intacto e inmutable; la auditoría registra el comando de corrección apuntando explícitamente a qué entrada corrigió. Esto preserva el Principio B (la auditoría nunca reemplaza la representación de la realidad) y permite colapsar visualmente el par en vistas consolidadas sin ocultar nada del historial de un elemento patrimonial específico.

Importante: en Evento Financiero y Ajuste Patrimonial la corrección compensa montos (flujo, se puede sumar/restar). En Valorización la corrección reemplaza el valor vigente por el valor correcto — nunca se suma al valor anterior, porque una valorización representa un estado (stock), no un movimiento.

## E. Elemento Patrimonial

| Comando | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| RegistrarElementoPatrimonial | Validar al menos un propietario · Validar que el hogar no sea propietario · Inicializar valor vigente · Recalcular patrimonio individual del/los propietario(s) | Creación: usuario, fecha, valor inicial, propietario(s), categoría |
| ActualizarDatosElementoPatrimonial | Ninguna sobre patrimonio (no toca valor) | Modificación: campo(s) cambiado(s), valor anterior/posterior |
| CorregirDatosElementoPatrimonial | Igual que actualizar, pero se marca como corrección, no como actualización | Corrección: distingue explícitamente de modificación — valor anterior/posterior + motivo |
| CambiarPropiedadElementoPatrimonial | Validar que siga habiendo ≥1 propietario · Recalcular patrimonio individual de todos los afectados (salientes y entrantes) | Cambio de propiedad: propietarios anteriores/posteriores |
| CambiarVisibilidadElementoPatrimonial | Ninguna sobre patrimonio | Cambio de visibilidad: valor anterior/posterior |
| CambiarParticipacionEnConsolidacion | Recalcular consolidación familiar del hogar | Cambio de consolidación: valor anterior/posterior |
| DesactivarElementoPatrimonial | Excluir de valor líquido y disponibilidad futura · Conservar en historial y consolidación pasada | Eliminación lógica |
| ReactivarElementoPatrimonial | Volver a incluir en valor líquido/disponibilidad según su configuración original · Recalcular patrimonio y consolidación | Reactivación: elemento, fecha, motivo |
| EliminarElementoPatrimonial | Verificar que no tenga impactos patrimoniales reales asociados (si los tiene, no es error de carga — debe usarse Desactivar) | Eliminación física — caso excepcional, requiere justificación |

*Nota: ReactivarElementoPatrimonial es un comando propio, distinto de volver a registrar el elemento. Reactivar recupera la misma entidad con su historial de valorizaciones e impactos intacto; registrar de nuevo generaría una entidad sin relación con la anterior, rompiendo trazabilidad.

Nota: EliminarElementoPatrimonial requiere la política de verificación para evitar que se elimine físicamente algo que ya generó movimientos reales, lo que rompería el Principio A (el estado vigente debe representar la realidad).*

## D. Evento Financiero

| Comando / Política | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| RegistrarEventoFinanciero | Generar impacto(s) patrimoniales · Actualizar valor vigente de elemento(s) afectados · Actualizar reservas si aplica · Recalcular patrimonio y consolidación · Recalcular información derivada | Creación: comando, usuario, fecha, monto, elementos afectados |
| MaterializarMovimientoProgramado | Dispara RegistrarEventoFinanciero con los datos confirmados/ajustados | Materialización: referencia al movimiento programado origen |
| AnularEventoFinanciero | Eliminar impactos patrimoniales asociados · Recalcular patrimonio y derivados | Anulación: motivo, evento anulado |
| CorregirEventoFinanciero | Generar evento compensatorio · Establecer relación de corrección con el evento original · Recalcular patrimonio y derivados | Corrección: evento original, evento compensatorio, motivo |

## Movimiento Programado (agregado propio)

Movimiento Programado no es un hecho económico hasta que se materializa: es planificación, de la misma naturaleza que Presupuesto, no una variante de Evento Financiero. Vive fuera del árbol de Evento Financiero hasta el momento exacto de materializarse.

| Comando | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| CrearMovimientoProgramado | Ninguna sobre patrimonio (no es hecho económico aún) | Creación: usuario, monto planificado, fecha programada, elemento(s) destino |
| ActualizarMovimientoProgramado | Ninguna sobre patrimonio | Modificación: campo(s), anterior/posterior |
| MaterializarMovimientoProgramado | Dispara RegistrarEventoFinanciero con datos confirmados/ajustados | Materialización: referencia al movimiento programado origen |
| CancelarMovimientoProgramado | Ninguna sobre patrimonio · No afecta saldos ni métricas históricas | Cancelación: motivo |

## G. Valorización

| Comando | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| RegistrarValorizacion | Reemplazar valor vigente del elemento · Conservar valor anterior en historial de valorizaciones · Generar impacto patrimonial · Recalcular patrimonio y consolidación · Recalcular información derivada | Creación: usuario, fecha, valor anterior, valor nuevo |
| AnularValorizacion | Revertir valor vigente al estado anterior a esta valorización · Eliminar impacto patrimonial asociado · Recalcular patrimonio y derivados | Anulación: motivo, valorización anulada |
| CorregirValorizacion | Generar valorización compensatoria enlazada a la original · Reemplazar valor vigente por el valor correcto (no sumar) · Recalcular patrimonio y derivados | Corrección: valorización original, valorización compensatoria, motivo |

*Nota: AnularValorizacion requiere que la cadena de valorizaciones sea recorrible en orden, para poder determinar cuál era el valor vigente inmediatamente antes de la valorización anulada.*

## L. Ajuste Patrimonial

| Comando | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| RegistrarAjustePatrimonial | Validar que exista motivo/justificación (obligatorio) · Generar impacto patrimonial · Recalcular patrimonio y consolidación · Recalcular información derivada | Creación: usuario, fecha, monto, elemento afectado, motivo |
| AnularAjustePatrimonial | Eliminar impacto patrimonial asociado · Recalcular patrimonio y derivados | Anulación: motivo, ajuste anulado |
| CorregirAjustePatrimonial | Generar ajuste compensatorio enlazado al original · Recalcular patrimonio y derivados | Corrección: ajuste original, ajuste compensatorio, motivo |

*Nota: el motivo/justificación de RegistrarAjustePatrimonial es obligatorio, no opcional. Ajuste Patrimonial es un mecanismo de excepción (no debe usarse como sustituto de modelar correctamente un evento financiero), y el motivo obligatorio es lo que permite a la auditoría distinguir una excepción justificada de un uso indebido.*

## H. Asignación

| Comando | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| CrearAsignacion | Ninguna sobre patrimonio | Creación: usuario, nombre, monto objetivo, objetivo asociado (si aplica) |
| ActualizarDatosAsignacion | Ninguna sobre patrimonio | Modificación: campo(s), valor anterior/posterior |
| CambiarAsociacionAObjetivo | Recalcular progreso del objetivo afectado (anterior y/o nuevo) | Cambio de asociación: objetivo anterior/posterior |
| EliminarAsignacion | Eliminar todas las reservas asociadas (cascada) · Liberar el valor reservado de cada una hacia sus elementos origen · Recalcular progreso de objetivo si estaba asociado | Eliminación: asignación, reservas eliminadas en cascada |

## I. Reserva

| Comando / Política | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| CrearReserva | Validar disponibilidad en elemento(s) origen · Descontar del valor libre · Recalcular progreso de objetivo asociado a la asignación | Creación: elemento origen, monto, asignación destino |
| AjustarMontoReserva | Re-validar disponibilidad · Recalcular valor libre · Recalcular progreso de objetivo | Modificación: monto anterior/posterior |
| LiberarReserva | Devolver monto al valor libre del elemento origen · Recalcular progreso de objetivo | Liberación: motivo, monto liberado |
| Consumir reserva (política, no comando) | Se dispara al ejecutar RegistrarEventoFinanciero asociado a una asignación · Ajusta/salda el valor reservado · Notifica al usuario del cambio · Recalcula progreso de objetivo | Se registra bajo el comando RegistrarEventoFinanciero que la originó, con referencia a la reserva afectada |

*Nota: el consumo de una reserva no es un comando invocable por el usuario. Se dispara automáticamente cuando un evento financiero real se asocia a la asignación correspondiente, y notifica al usuario como efecto secundario (Principio 4).*

## J. Objetivo Financiero

| Comando / Política | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| CrearObjetivoFinanciero | Ninguna sobre patrimonio · Estado inicial: En progreso | Creación: usuario, nombre, monto objetivo, fecha objetivo |
| ActualizarDatosObjetivoFinanciero | Ninguna sobre patrimonio | Modificación: campo(s), valor anterior/posterior |
| CambiarEstadoObjetivoFinanciero (manual) | Ninguna sobre patrimonio · Notifica al usuario | Cambio de estado: estado anterior/posterior, origen manual |
| EliminarObjetivoFinanciero | Desasociar asignaciones (sin cascada, sin tocar su valor reservado) | Eliminación: objetivo, asignaciones desasociadas |
| Completar objetivo (política) | Se dispara al recalcular progreso desde Asignación/Reserva y alcanzar el monto objetivo · Cambia estado a Completado · Notifica al usuario | Se registra bajo el comando que originó el recálculo, con referencia al objetivo afectado |

*Estados del objetivo: En progreso / Completado / Cancelado. La transición a Completado es automática (política) al alcanzar el progreso el monto objetivo, con notificación al usuario, y siempre editable manualmente ante una decisión repentina o un caso excepcional (Principio 4).

Ciclo de vida cerrado: CambiarEstadoObjetivoFinanciero es el comando universal de transición manual entre cualquier par de estados (incluye reabrir un objetivo Cancelado o Completado). Ninguna transición de estado afecta patrimonio ni genera cascada sobre las asignaciones asociadas — estas siguen reservando valor real independientemente del estado del objetivo, porque el estado es solo una etiqueta de intención, no un mecanismo patrimonial.*

## A. Hogar

| Comando | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| CrearHogar | Usuario creador → Administrador automático | Creación: usuario, nombre |
| ActualizarDatosHogar | Ninguna sobre patrimonio | Modificación: campo(s) |
| CambiarMonedaConsolidacion | Recalcular todas las consolidaciones en nueva moneda | Cambio: moneda anterior/posterior |
| InvitarMiembro | Genera invitación pendiente | Invitación: emisor, invitado |
| AceptarInvitacion | Dispara "UnirseAHogar" (política): crea membresía, rol Miembro estándar por defecto | Aceptación: usuario, hogar |
| RechazarInvitacion | Cierra invitación pendiente | Rechazo: usuario, hogar |
| AsignarRol | Validar que quede ≥1 administrador tras el cambio | Cambio de rol: anterior/posterior |
| RemoverMiembro | Validar que no sea el último administrador · Elementos individuales del removido quedan intactos, fuera de esta consolidación | Remoción: miembro, hogar |
| EliminarHogar | Desvincular todos los miembros · Elementos patrimoniales (individuales y compartidos) sobreviven fuera del contenedor de consolidación | Eliminación: hogar, miembros desvinculados |

*Nota: UnirseAHogar no es un comando independiente — es una política disparada exclusivamente por AceptarInvitacion. Esto evita que pueda crearse una membresía sin una invitación válida de por medio, protegiendo estructuralmente el invariante de gobierno (todo usuario pertenece a un hogar por creación o por invitación aceptada).

Nota: EliminarHogar no elimina economía. La aplicación no es dueña del patrimonio (Principio 3): solo desaparece la entidad organizativa "Hogar" y sus vínculos de membresía. Los elementos patrimoniales, individuales o compartidos, sobreviven y siguen perteneciendo a sus propietarios.*

## B. Usuario

| Comando | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| RegistrarUsuario | Ninguna sobre hogar (el usuario puede existir momentáneamente sin hogar durante el flujo de alta) | Creación: usuario |
| ActualizarDatosUsuario | Ninguna | Modificación: campo(s) |
| SalirDeHogar | Validar que no sea el último administrador · Sus elementos individuales quedan intactos | Salida: usuario, hogar |
| DesactivarUsuario | Elementos patrimoniales y membresías históricas se conservan | Desactivación |

## Deuda / Crédito (especialización de Elemento Patrimonial)

Deuda y Crédito son elementos patrimoniales, no un agregado nuevo: heredan todos los comandos de Elemento Patrimonial (RegistrarElementoPatrimonial, CambiarPropiedadElementoPatrimonial, CambiarVisibilidadElementoPatrimonial, CambiarParticipacionEnConsolidacion, ActualizarDatosElementoPatrimonial, CorregirDatosElementoPatrimonial, DesactivarElementoPatrimonial, EliminarElementoPatrimonial). El cambio en el valor pendiente se produce vía RegistrarEventoFinanciero o RegistrarAjustePatrimonial, ya existentes — no requiere comandos nuevos. El estado operativo (activa, pagada, etc.) se deriva automáticamente del valor pendiente, como política, no como comando.

| Comando / Política | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| CondonarDeuda | Generar impacto patrimonial que lleva valor pendiente a cero · Recalcular patrimonio y consolidación · Conservar elemento para efectos históricos | Condonación: deuda, valor condonado, motivo |
| DeclararIncobrable | Generar impacto patrimonial que lleva valor pendiente a cero · Recalcular patrimonio y consolidación · Conservar elemento para efectos históricos | Declaración de incobrabilidad: crédito, valor, motivo |
| Derivar estado operativo (política) | Se recalcula automáticamente tras cualquier evento/ajuste que modifique el valor pendiente | Se registra bajo el comando que lo originó, sin entrada propia |

*CondonarDeuda y DeclararIncobrable se mantienen como comandos separados, aunque ambos llevan el valor pendiente a cero: condonar es una decisión activa del acreedor, incobrable es un reconocimiento de que no se recuperará. Distinguirlos desde el comando (y no solo mediante un campo interno) evita deuda técnica si más adelante se requiere diferenciarlos para efectos legales o contables.*

## K. Presupuesto

| Comando | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| CrearPresupuesto | Ninguna sobre patrimonio | Creación: usuario/hogar, tipo, período, montos esperados |
| ActualizarDatosPresupuesto | Ninguna sobre patrimonio | Modificación: campo(s), anterior/posterior |
| CerrarPresupuesto | Ninguna sobre patrimonio · Preserva comparación presupuesto-vs-real para consulta futura | Cierre: presupuesto, fecha, motivo |
| EliminarPresupuesto | Ninguna — sin cascada, sin dependientes | Eliminación: presupuesto |

*Un presupuesto periódico no requiere estado propio: su vigencia es una propiedad calculada según si la fecha actual cae dentro del intervalo definido, no un campo persistido. No necesita comando de cierre — termina cuando termina su intervalo, un hecho de calendario, no un evento de negocio.

Un presupuesto específico (asociado a un propósito sin periodicidad) sí necesita estado explícito — Activo / Cerrado — porque no existe una señal automática de calendario que indique que el propósito terminó. CerrarPresupuesto sigue el mismo patrón que Desactivar vs. Eliminar en Elemento Patrimonial: cerrar preserva el historial de comparación presupuesto-vs-real para consulta futura; eliminar lo borra por completo. Se usa Cerrar cuando el presupuesto cumplió su ciclo y se quiere conservar el análisis; se usa Eliminar solo si el presupuesto nunca debió existir (error de carga).*

### Elemento Patrimonial — comando adicional (revisión de cierre)

| Comando | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| ReactivarElementoPatrimonial | Volver a incluir en valor líquido/disponibilidad según su configuración original · Recalcular patrimonio y consolidación | Reactivación: elemento, fecha, motivo |

*Comando propio, distinto de RegistrarElementoPatrimonial: reactivar recupera la misma entidad con su historial intacto (valorizaciones, impactos previos), en vez de crear una entidad nueva sin relación con la anterior.*

## Movimiento Programado (agregado propio, revisión de cierre)

No es un hecho económico hasta que se materializa — es planificación, de la misma naturaleza que Presupuesto. Vive fuera del árbol de Evento Financiero hasta el momento exacto de materializarse.

| Comando | Políticas que dispara | Qué registra auditoría |
| --- | --- | --- |
| CrearMovimientoProgramado | Ninguna sobre patrimonio (no es hecho económico aún) | Creación: usuario, monto planificado, fecha programada, elemento(s) destino |
| ActualizarMovimientoProgramado | Ninguna sobre patrimonio | Modificación: campo(s), anterior/posterior |
| MaterializarMovimientoProgramado | Dispara RegistrarEventoFinanciero con datos confirmados/ajustados | Materialización: referencia al movimiento programado origen |
| CancelarMovimientoProgramado | Ninguna sobre patrimonio · No afecta saldos ni métricas históricas | Cancelación: motivo |

### Candidato descartado en la revisión de cierre

ReasignarOrigenReserva: se evaluó y se descartó. El origen de financiamiento de una Reserva se fija al crearla; cambiarlo no requiere un comando nuevo, se logra combinando LiberarReserva (del origen anterior) más CrearReserva (desde el origen nuevo) — dos hechos de negocio ya cubiertos por comandos existentes. Introducir un comando adicional duplicaría funcionalidad sin necesidad real.

# U. Registro de Auditoría

Una entrada de auditoría no es un registro de cambios de estado de una entidad — es el registro de un comando ejecutado, con su contexto. Esta distinción evita construir la auditoría como un log de versionado de campos y la mantiene alineada con el Principio E (la auditoría registra los comandos ejecutados) y el Principio C (historial de negocio ≠ auditoría).

### Campos universales (toda entrada, sin excepción)

- Comando ejecutado.
- Usuario responsable.
- Fecha y hora.
- Entidad(es) afectada(s).

### Campos condicionales (según el tipo de comando)

- Valor(es) anterior/posterior — en comandos que modifican un campo o monto existente.
- Motivo/justificación — obligatorio en Ajuste Patrimonial, Condonación, Incobrabilidad y Corrección; opcional o ausente en creación simple.
- Referencia a entidad relacionada — el evento original en una corrección, la reserva afectada en un consumo automático, el movimiento programado origen en una materialización.

### Regla de encadenamiento para políticas automáticas

- Política 1-a-1 y muda (ej.: consumir reserva, derivar estado operativo de deuda) → se registra embebida en la entrada del comando raíz que la disparó.
- Política que se ramifica a múltiples entidades, o tiene valor de consulta propio como evento de negocio (ej.: completar objetivo financiero, recalcular consolidación en múltiples hogares) → genera su propia entrada, encadenada al comando que la originó.

# V. Reconstrucción histórica

Existen dos reconstrucciones distintas, cada una con su propia fuente — no deben confundirse:

- Reconstrucción de estado: responde "¿cuál era el valor/estado de esta entidad en un momento pasado?". Se construye a partir del historial de negocio (eventos financieros, valorizaciones, ajustes — todos inmutables y con fecha), filtrando los ocurridos hasta ese momento y aplicándolos en orden. La auditoría no participa en esta reconstrucción.
- Reconstrucción de responsabilidad/trazabilidad: responde "¿quién hizo qué y cuándo?". Se construye exclusivamente a partir de la auditoría. No reconstruye valores, solo la secuencia de comandos ejecutados y sus autores.

# W. Políticas del dominio

Catálogo consolidado y transversal. Las tablas de comandos de la Sección T mencionan estas políticas por agregado como recordatorio de qué se ve afectado en cada caso; esta sección las define una sola vez para evitar repetir la misma regla decenas de veces.

### Política transversal única de recálculo

Tras la ejecución de cualquier comando que modifique información primaria (patrimonio, propiedad, consolidación, asignaciones o reservas), el dominio recalcula automáticamente toda la información derivada afectada: patrimonio individual, patrimonio familiar consolidado, métricas patrimoniales, progreso de objetivos financieros, y desviaciones presupuestarias. No se declara por comando — es consecuencia directa del Principio 1.

### Políticas de validación de invariantes (específicas por agregado)

- Elemento Patrimonial: al menos un propietario; el hogar nunca es propietario.
- Hogar: siempre debe quedar al menos un administrador.
- Reserva: la suma reservada no puede exceder la disponibilidad de sus fuentes de financiamiento.
- Ajuste Patrimonial: motivo/justificación obligatorio.

### Políticas de consecuencia automática con notificación (Principio 4)

- Consumir reserva — al asociar un evento financiero a una asignación.
- Completar objetivo financiero — al alcanzar el progreso el monto objetivo.
- Derivar estado operativo de deuda/crédito — al modificar el valor pendiente.

### Políticas de propagación por relación de origen

- Si desaparece la causa de un impacto patrimonial (anulación de evento, valorización o ajuste), sus impactos asociados desaparecen con ella.
- Eliminar una Asignación elimina en cascada sus Reservas y libera el valor hacia los elementos origen.
- Eliminar un Objetivo Financiero desasocia sus Asignaciones sin cascada — estas sobreviven intactas.

### Política de auditoría (transversal a todo comando)

Ver Sección U — Registro de Auditoría.

# X. Decisiones de dominio posteriores a Fase 0 (Fases 1–52)

Esta sección recoge las decisiones de dominio tomadas durante la implementación,
cada una registrada en `GAPS.md` con su alternativa considerada. Extiende, no
reemplaza, las secciones A–W.

## X.1 · Elemento Patrimonial (§E)

**Visibilidad granular** (GAPS G6). La visibilidad deja de ser un enum único: se
declara por **tipo de información** — `EXISTENCIA`, `VALOR`, `MOVIMIENTOS` — y por
**nivel** — `PRIVADA` (nadie), `COMPARTIDA` (personas concretas), `FAMILIAR`
(todos los co-miembros). El nivel base del elemento aplica salvo que se
sobreescriba un tipo puntual. Comando: `DefinirVisibilidadElementoPatrimonial`.
Regla §M: un co-miembro que no ve la `EXISTENCIA` de un elemento no lo encuentra
en ningún listado ni selector; si ve la existencia pero no el `VALOR`, los montos
llegan en 0 con `valorOculto = true`.

**Ventana de existencia** (GAPS G18). El elemento tiene `fecha_alta` (obligatoria,
por defecto hoy) y `fecha_baja` (al Desactivar). La reconstrucción histórica
(§V) solo lo considera dentro de `[fecha_alta, fecha_baja)`.

**Saldo inicial como hecho económico** (GAPS G29). Al registrar un elemento
`LIQUIDEZ` o `RESERVA` con `valorInicial > 0`, `RegistrarElementoPatrimonial`
crea en la misma transacción un `EventoFinanciero` de tipo **`SALDO_INICIAL`** y
su impacto (`+valorInicial`, `fecha = fecha_alta`). El elemento nace en 0 y el
impacto lo lleva a su valor → la reconstrucción de estas cuentas queda 100 %
basada en impactos. `INVERSION`/`ACTIVO` **no** lo generan (el valor de apertura
de un inmueble o un fondo no es un ingreso — es una valorización inicial).
`SALDO_INICIAL` no es invocable por el usuario, no se anula ni se corrige (para
ajustar una apertura mal cargada: Ajuste Patrimonial).

## X.2 · Deuda / Crédito (§E, especialización)

**Estado operativo derivado** (GAPS G1). De `valor_pendiente` y
`valor_pendiente_inicial` + las fechas se deriva —como política, no como campo—
uno de: `VIGENTE`, `PARCIALMENTE_PAGADA`, `EN_MORA`, `SALDADA`, `CONDONADA`,
`INCOBRABLE`. Se recalcula tras cada impacto que toque el pendiente.

**Información adicional** (GAPS G-J, REQUISITES §J). Campos opcionales:
contraparte, fecha de inicio/término, monto de cuota, tasa de interés,
observaciones. El **interés** se registra como `RegistrarAjustePatrimonial`
(no requiere comando ni tabla nuevos).

**Naturaleza** (GAPS G28). Al registrar se declara `naturaleza`:
- **`FINANCIERA`** — crédito o préstamo real (hipotecario, consumo, tarjeta, un
  préstamo entre personas que se espera devolver como obligación).
- **`CUSTODIA_INFORMAL`** — dinero de un tercero que solo pasa por las cuentas del
  usuario y nunca fue suyo (un encargo: me transfieren para que compre algo). El
  neto patrimonial se comporta igual que una deuda, pero no es una obligación
  financiera: se "salda" entregando lo comprado, no pagando.

`naturaleza` es **atributo del comando `RegistrarElementoPatrimonial`** cuando la
categoría es DEUDA/CREDITO (obligatorio, por defecto `FINANCIERA`; NULL en el
resto). Se distingue desde el comando —no con un flag de presentación— por el
mismo criterio que `CondonarDeuda` vs `DeclararIncobrable`: si mañana hace falta
tratamiento legal/contable diferenciado, la distinción ya está en el modelo. No
genera comando nuevo, no dispara políticas sobre el patrimonio, no altera el
valor vigente ni el estado operativo.

## X.3 · Evento Financiero (§D)

**Tipos**: `INGRESO`, `GASTO`, `TRANSFERENCIA`, `CONVERSION` (cambio de moneda
entre dos elementos, GAPS G8), `SALDO_INICIAL` (X.1). `PRESTAMO` se descartó —
un préstamo es un elemento Deuda/Crédito, no un tipo de evento.

**Glosa y categoría** (GAPS G22/G23). El evento acepta una `glosa` (texto libre
corto) y una `categoria_id` opcional. La categoría pertenece al **hogar**
(vocabulario compartido), puede anidarse en 2 niveles, y tiene un
`tipo_aplicable` (INGRESO/GASTO/AMBOS). Glosa y categoría son **anotación, no
hecho económico**: su historial vive solo en `auditoria`, no participan de la
reconstrucción (§V).

**Etiquetas** (GAPS G23). Ortogonales a la categoría: personales, transversales,
N:M con el evento. Comando `EtiquetarEvento` (reemplazo del conjunto).

**Transferencias en las lecturas** (GAPS G30 / F1). `resumen-financiero.movimientos`
incluye TRANSFERENCIA/CONVERSION como filas neutras con `efectoPropio` (impacto
neto sobre las cuentas propias del alcance consultado); **no** suman a los
totales de ingreso/gasto. La vista consolidada del hogar
(`/hogares/:id/eventos-financieros`) colapsa la transferencia a un solo
movimiento (REQUISITES §K, punto 13) y filtra por §M: solo eventos que tocan un
elemento consolidado del hogar o de propiedad del actor.

## X.4 · Movimiento Programado (§S, resuelto)

Gana `tipo` (INGRESO/GASTO/TRANSFERENCIA) y `elemento_origen_id`; el destino pasa
a opcional (GAPS G2). **Visibilidad y propiedad se heredan del elemento**
afectado — no hay columnas ni reglas propias. Materializar dispara un
`RegistrarEventoFinanciero` del tipo correspondiente.

**Recurrencia** (G33, D-6 / HZ-16). Un programado puede repetirse cada mes o
cada año, el mismo día, y lleva categoría (solo INGRESO y GASTO, G23). Cada
ocurrencia es su propio movimiento programado (1 programado → 1 evento); las de
una serie comparten `serie_id`. Cuando la última ocurrencia llega a su fecha se
genera la siguiente, aunque las anteriores sigan sin respuesta. **Ninguna se
materializa sola**: al llegar la fecha se avisa "¿Se pagó?" (o "¿Llegó?" en un
ingreso; Principio 4) y queda PENDIENTE hasta que el usuario confirma (puede
ajustar el monto), la cancela ("Este mes no") o deja de repetir la serie. La
ocurrencia generada deriva de la serie, como el aviso: no es un comando del
usuario y no se audita; su materialización sí.

## X.5 · Objetivo Financiero y Asignación (§H, §J)

**Propiedad** (GAPS G13). Son **personales** del creador por defecto. Un objetivo
puede además **compartirse con un hogar** (`CompartirObjetivoConHogar`): todos
los miembros lo ven, los **designados** (`DefinirDesignadosObjetivo`) lo
modifican, el admin asigna. El estado del objetivo sigue siendo solo una etiqueta
de intención — no afecta patrimonio ni las reservas asociadas.

**Moneda** (GAPS G16). Objetivo, asignación y presupuesto llevan `moneda` como
**etiqueta** (sin conversión): solo afecta a esa entidad, no se ramifica. La
reserva usa la moneda de su elemento origen.

## X.6 · Presupuesto (§K)

**Propiedad** (GAPS G15): INDIVIDUAL → del creador; FAMILIAR → del hogar.

**Por rubro** (GAPS G26). `presupuesto_linea` fija el monto esperado por
categoría; `presupuesto_linea_ahorro` el ahorro esperado por objetivo. La
proyección `desviacion_presupuestaria` se desglosa `porRubro` + `porObjetivo` +
`sinClasificar`. `SALDO_INICIAL` **no** cuenta como ingreso presupuestable.

## X.7 · Multimoneda (§Q, REQUISITES §S)

Comando **`RegistrarTipoCambio`** (#53). `tipo_cambio` es global e inmutable (una
fila por tasa con su fecha de vigencia). `ConversionService` triangula por pivote
si no hay par directo. El consolidado del hogar trae `total` en su moneda (o
`conversionesFaltantes`). Las demás vistas siguen sin conversión (desglose por
moneda) — GAPS G7.

## X.8 · Catálogo de comandos — añadidos a la Sección T

| Agregado | Comandos nuevos |
|---|---|
| Elemento Patrimonial | `DefinirVisibilidadElementoPatrimonial` |
| Evento Financiero | `CrearCategoriaMovimiento`, `ActualizarCategoriaMovimiento`, `ArchivarCategoriaMovimiento`, `ReordenarCategoriasMovimiento`, `CrearEtiqueta`, `ActualizarEtiqueta`, `EliminarEtiqueta`, `EtiquetarEvento`, `CrearPlantillaMovimiento`, `ActualizarPlantillaMovimiento`, `EliminarPlantillaMovimiento` |
| Elemento Patrimonial (visualización) | `CrearAgrupacion`, `ActualizarAgrupacion`, `EliminarAgrupacion`, `DefinirElementosAgrupacion`, `CrearTipoElemento`, `ActualizarTipoElemento`, `ArchivarTipoElemento` |
| Objetivo Financiero | `CompartirObjetivoConHogar`, `DefinirDesignadosObjetivo` |
| Presupuesto | `DefinirLineasPresupuesto`, `DefinirLineasAhorroPresupuesto` |
| Tipo de Cambio | `RegistrarTipoCambio` |
| Orquestaciones de G33 (sobre comandos existentes) | `AhorrarParaObjetivo`, `RegistrarPlataDeOtraPersona`, `RegistrarGastoCompartido`, `AvisarTransferenciaSinAnotar`, `PagarSolicitud`, `RechazarSolicitud` |

Estos comandos que operan sobre **categorías, etiquetas, agrupaciones, tipos de
elemento y plantillas** son configuración/anotación: escriben en `auditoria`
pero no generan impactos patrimoniales ni participan de la reconstrucción (§V).
El detalle de cada uno (input · validaciones · output) está en
`APPLICATION_SERVICES.md`.

## X.9 · Simplificaciones asumidas (de `DOMINIO_PENDIENTE.md` §C)

- **Multi-hogar**: un usuario puede pertenecer a varios hogares, pero un elemento
  con `participa_consolidacion` entra en la consolidación de **todo** hogar donde
  alguno de sus propietarios sea miembro. No hay `elemento.hogar_consolidacion_id`
  (GAPS G19). Solo importaría con un usuario en 2+ hogares consolidando en serio.
- **Proyecciones en vivo**: `patrimonio_individual`, consolidado, progreso de
  objetivo y desviación presupuestaria se calculan en cada consulta, no se
  materializan (GAPS G7). Decisión revisable si aparece un problema de performance.
- **Sin conversión** fuera del consolidado del hogar: los reportes por período y
  la reconstrucción dan desglose por moneda, sin total único.
- **Comentarios y adjuntos** en entidades (REQUISITES §D/§M): sin modelar — única
  decisión de dominio de `DOMINIO_PENDIENTE.md` §B que sigue abierta (§B4).

## X.10 · Solicitudes entre miembros del hogar (G33 bloque 9: D-7, HZ-21)

Un miembro le pide a otro que anote una TRANSFERENCIA hacia una cuenta suya:
su parte de un gasto compartido (M7) o una transferencia que ya le llegó pero
no está anotada. **No es un agregado del dominio**: es una notificación con
estado (Principio 4), guardada en `solicitud_transferencia`, una tabla de apoyo
como `notificacion`. No genera impactos ni auditoría propia; los hechos
económicos siguen siendo eventos normales:

- quien pagó registra el **GASTO por el total** (la atribución del gasto por
  persona sigue fuera de alcance, `DECISIONES_FASE_D_S01.md` §3);
- quien debe su parte registra la **TRANSFERENCIA** desde su cuenta (la
  transferencia entre miembros la registra siempre quien la envía, D-8).

El **estado se deriva** de esos eventos al leer, así nunca se desfasa: pago
vigente → pagada; gasto anulado → anulada; "No me corresponde" → rechazada; si
no, pendiente. Anular la transferencia que la pagó la deja pendiente otra vez.
La cuenta donde se recibe tiene que ser visible para el otro miembro (nivel
D-2 "Que puedan transferirte" o más); si deja de serlo, el pago se rechaza con
la misma regla que cualquier transferencia (`puedeRecibirTransferencia`).
