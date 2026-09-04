# Dominio vs. implementación — qué falta y cómo guía la UI

Relectura completa de los 6 docs (`DDD`, `APPLICATION_SERVICES`, `DATABASE_DESIGN`,
`REQUISITES`, `UX_FLOWS`, `API_DESIGN`) contra el estado del código a la Fase 28.

**Resumen en una línea:** el modelo de dominio está **cerrado y los 52 comandos
están implementados**. Lo que falta es (A) **exponer en la UI conceptos que ya
existen en el backend**, (B) un puñado de **decisiones de dominio** que los propios
docs dejaron abiertas, y (C) asumir conscientemente unas **simplificaciones**
técnicas que hoy limitan la experiencia.

La conclusión para UI/UX está al final (§ "Cómo esto estructura la app").

> **Estado a Fase 30 (2026-09-03).** Todo el bloque §A sin decisiones está
> implementado: **A1, A2, A3, A5, A6, A7, A9** (Fases 29–30). Quedan en §A solo
> los que requieren una definición o diseño de UX: **A4** (¿el usuario final
> distingue "editar" de "corregir"?), **A8** (transferir a elemento de otro
> miembro — atado a §B1), **A10** (guía proactiva hacia Crédito — diseño de UX),
> **A11** (consistencia multi-hogar — chore transversal). El resto del trabajo
> disponible son las **decisiones §B**.

---

## A. Ya está en el dominio y en el backend — falta mostrarlo

Esto es **puro trabajo de UI**, sin decisiones pendientes. Es donde más gana la app.

**Implementados en Fases 29–30:** A1, A2, A3, A5, A6, A7, A9.

### A1 · Disponibilidad financiera: líquido / reservado / **libre**
`REQUISITES §H` lo define como distinción **obligatoria**:
- **Valor líquido** = Σ elementos con `participa_valor_liquido`.
- **Valor reservado** = Σ reservas ACTIVAS.
- **Valor libre** = líquido − reservado = "lo que puedo usar sin tocar una meta".

El backend ya lo calcula (`progreso.service.ts → disponibilidad(elementoId)`),
pero **solo se usa para validar `CrearReserva`**. No aparece en ninguna pantalla.

**Falta:** en el detalle de un elemento y en el Inicio, mostrar `vigente − reservado
= libre`, y la lista de reservas que "pesan" sobre ese elemento. Ver [B nota del
usuario, sesión posterior].

### A2 · El elemento como fuente de reservas
`REQUISITES §F`: *"El sistema debe permitir reflejar separadamente el origen de la
reserva y el origen efectivo del movimiento asociado"* y *"cada reserva mantiene
trazabilidad respecto de los elementos que financian el valor reservado"*.

Hoy: desde una asignación ves sus reservas; desde el **elemento** no ves qué
reservas financia. La relación existe (`reserva.elemento_origen_id`), no se muestra.

**Falta:** endpoint `GET /elementos-patrimoniales/:id/reservas` (proyección de
lectura) + sección "Reservado para metas" en el detalle del elemento.

### A3 · Cambiar la propiedad de un elemento después de crearlo
`CambiarPropiedadElementoPatrimonial` (AS #4) **está implementado** (endpoint
`/comandos/CambiarPropiedadElementoPatrimonial`). La app solo deja fijar
copropiedad **al crear** (wizard, Fase 27). No hay UI para corregir el reparto
después.

**Falta:** en "Editar", una sección de propietarios (mismo componente de % del
wizard) → `CambiarPropiedadElementoPatrimonial`.

### A4 · "Editar" vs "Corregir" — son dos comandos distintos
El dominio separa `ActualizarDatosElementoPatrimonial` (#2, modificación normal)
de `CorregirDatosElementoPatrimonial` (#3, **con motivo obligatorio**, categoría de
auditoría distinta — "corrección" vs "modificación"). La app solo expone #2.

`UX_FLOWS` Flujo 3/6 insiste en que la UI debe **comunicar la corrección sin
exponer el mecanismo** (entrada compensatoria) y **colapsar visualmente** el par
original+corrección.

**Falta:** decidir si el usuario final necesita distinguir "me equivoqué al
escribir el nombre" (editar) de "el nombre estaba mal registrado y quiero que
quede constancia" (corregir). Probablemente sí para elementos compartidos.

### A5 · Historial de auditoría — "¿quién cambió esto?"
`REQUISITES §P` es enfático: la trazabilidad (usuario, fecha, valor anterior/
posterior, tipo de acción) *"forma parte de la integridad del sistema"*. El
backend **escribe toda la auditoría** (`AuditoriaService`, en la misma transacción
de cada comando). **No hay ninguna pantalla que la muestre.**

`DDD §V` distingue dos reconstrucciones: la de **estado** (ya la hace
`ReconstruccionService`) y la de **responsabilidad** ("quién hizo qué y cuándo",
solo desde `auditoria`) — esta última no tiene ni endpoint ni pantalla.

**Falta:** `GET /auditoria?entidad=...` + un "Historial de cambios" en el detalle
de cada entidad. Es **clave para uso familiar**: si dos personas editan un
elemento compartido, hoy no hay forma de ver quién movió qué.

### A6 · Reconstrucción de estado a una fecha puntual
`ReconstruccionService` (Fase 9) sabe responder "¿cuánto valía X el 1 de marzo?".
`EvolucionPatrimonioScreen` muestra la **serie**, pero no hay:
- un selector "¿cuánto tenía yo el [fecha]?" (patrimonio a una fecha),
- el valor histórico **por elemento** en su detalle.

### A7 · Asignaciones independientes (sin objetivo)
`REQUISITES §L`: *"El sistema debe permitir asignaciones que no estén asociadas a
ningún objetivo financiero… propósitos de reserva que no requieren una meta
explícita"* (ej. "Fondo de emergencia virtual", "Navidad"). El backend lo soporta
(`asignacion.objetivo_financiero_id NULL`).

Hoy en la app **solo se llega a una asignación entrando por un objetivo** →
las asignaciones independientes **no se pueden crear ni ver**.

**Falta:** una pantalla "Asignaciones" (o dentro de Planificar) que liste todas
—con y sin objetivo— y permita crear una suelta.

### A8 · Transferir a un elemento de otro miembro del hogar
`UX_FLOWS` Flujo 1 paso 4 ("le transfiero a mi esposa para Netflix"). El backend
**ya lo permite** (`evento.service #validarDestino`: el destino puede ser de un
co-miembro). El bloqueo es de UI: `GET /elementos-patrimoniales?propietario=me`
solo devuelve los tuyos, así que el selector no tiene qué ofrecer.

**Falta:** un endpoint "elementos visibles para mí en el hogar" — cruza con la
decisión de visibilidad granular (§B1).

### A9 · Colapso visual de corrección + original
`GAPS G10` + `UX_FLOWS` Flujo 6: hoy el detalle de un elemento muestra el evento
original y su corrección como **dos filas separadas**. El DDD sugiere colapsarlas
en una sola línea con el neto. El backend ya expone `correccion_de_id`.

### A10 · Guía proactiva hacia el flujo correcto
`UX_FLOWS` Flujo 1 paso 6 (decisión de UX **exigida por el dominio**): cuando
alguien registra "pagué el mercado de mis papás, me devuelven en 3 días" como un
gasto simple, la app **debería sugerir** crear un **Crédito** para no perder la
trazabilidad. Hoy no hay ninguna sugerencia contextual.

### A11 · Multi-hogar
`REQUISITES §B` / `DDD §B`: un usuario puede pertenecer a varios hogares. El Inicio
tiene selector de hogar activo, pero muchas pantallas asumen `hogares[0]`
(categorías, reportes del hogar, presupuesto familiar). Consistencia pendiente.

---

## B. Decisiones de dominio que los docs dejaron abiertas

Requieren **tu decisión + (casi siempre) una migración** antes de ser UI.
Ya están en `GAPS.md`; las repito priorizadas por impacto en UX.

### B1 · Visibilidad granular por tipo de información — `GAPS G6`
`REQUISITES §M` define visibilidad **por tipo**: existencia · valor · movimientos ·
reservas/asignaciones · objetivos · presupuestos · comentarios · documentos. Y
tres niveles: Privada / Compartida / **Familiar**.

Hoy: **un solo enum** `visibilidad` (PRIVADA/COMPARTIDA/FAMILIAR) y **no hay tabla
"compartido con quién"** → COMPARTIDA y FAMILIAR se comportan igual.

**Impacto UX:** sin esto no hay forma real de "comparto el saldo pero no los
movimientos", ni de listar los elementos de otro miembro (§A8). Es la decisión de
dominio con **más efecto en la experiencia de hogar**.

### B2 · Estado operativo de Deuda/Crédito — `GAPS G1`, `UX_FLOWS` Flujo 4
El DDD dice que el estado "se deriva del valor pendiente" pero **no nombra los
valores intermedios** entre "activa" y "saldada". Decisión (Fase 8): no se
introdujo un enum; el estado es un cálculo de lectura (% pagado).

**Para decidir:** ¿basta mostrar "% pagado / saldo pendiente", o hace falta un
estado formal ("vigente / en mora / parcialmente pagada / saldada / incobrable")
para reportes y para el color en la lista?

### B3 · Información adicional de Deuda/Crédito — `REQUISITES §J`
Los docs listan campos **opcionales**: acreedor, deudor, fecha inicio/término,
cuota, tasa de interés, observaciones. **Ninguno está en el esquema.**

**Impacto UX:** hoy una deuda es solo "nombre + saldo". Para que la app sea útil
con créditos reales (un crédito hipotecario, un préstamo a un amigo) hace falta al
menos fecha de término y cuota. Migración: columnas opcionales en
`elemento_patrimonial` o tabla hija `detalle_deuda`.

### B4 · Comentarios y documentos adjuntos — `REQUISITES §M / §D`
Listados como tipos de información con visibilidad propia. **No modelados.**
`GAPS G22` propuso una tabla `comentario` polimórfica y se descartó por ahora
(se hizo `glosa` en el evento). Nada para adjuntar una boleta, un contrato, etc.

### B5 · Movimiento Programado: tipo, destino múltiple, visibilidad — `GAPS G2`
Hoy: solo **INGRESO**, **un** destino, sin reglas de visibilidad. No se puede
programar un **gasto** ("arriendo el día 5") ni una **transferencia**.
`DDD §S` deja explícitamente para después si hereda visibilidad del destino o
tiene la suya. Es la funcionalidad de planificación más pedida en apps de este
tipo.

### B6 · Objetivos / asignaciones compartidos por hogar — `GAPS G13`
Hoy son **personales** (`usuario_id`). Pero el "objetivo Casa" del caso de uso
típico es implícitamente **de la pareja**. `REQUISITES §I` habla de metas del
hogar. Decisión: ¿un objetivo puede ser familiar y sumar reservas de varios
miembros?

### B7 · "Asignaciones esperadas" en el presupuesto — `GAPS G15 / G26`
`DDD §K` / `REQUISITES §N`: el presupuesto debe *"Definir asignaciones esperadas"*.
Se implementó `presupuesto_linea` **por categoría de gasto** (Fase 15d), pero
**no** una línea de **ahorro esperado por objetivo/asignación**. Cierra del todo
G15.

### B8 · Moneda en reservas / asignaciones / presupuestos / objetivos
`REQUISITES §S`: *"Las reservas, asignaciones, presupuestos y objetivos financieros
pueden expresarse en una moneda determinada"*. Hoy **ninguno** tiene campo
`moneda` — se asume la del elemento / CLP. Con multi-moneda real (un objetivo en
USD) esto se nota.

### B9 · Categorías jerárquicas — `GAPS G23`
Decisión (Fase 15c): lista **plana**. `DDD` sugiere 2 niveles ("Servicios ›
Internet"). Se puede agregar `categoria_padre_id` sin romper datos.

### B10 · Reconstrucción histórica: fecha de alta/baja y fecha de anulación — `GAPS G18`
Hoy la reconstrucción no distingue "el elemento no existía todavía" y trata un
evento hoy anulado como inexistente en toda la línea de tiempo (la anulación no
tiene fecha de hecho económico). Afecta la exactitud del gráfico de evolución
hacia atrás.

---

## C. Simplificaciones asumidas (limitan la UX, sin migración de por medio)

Todas están en `GAPS.md`. No son bugs — son decisiones. Conviene revisarlas.

| # | Simplificación | Efecto en la UX |
|---|---|---|
| `G9` | `CorregirEventoFinanciero` solo corrige **el monto** | Cambiar fecha/tipo/cuenta de un movimiento = anular + registrar de nuevo |
| `G9`/`G11` | Solo se puede anular/corregir **la última** corrección / valorización | No se puede tocar una valorización intermedia |
| `G11` | `admite_valorizacion` se fija al crear, sin comando para cambiarlo | Si creaste un activo sin el flag, no lo puedes valorizar nunca |
| `G14` | "Consumir reserva" es **grueso**: al asociar un evento a una asignación, **todas** sus reservas ACTIVAS pasan a CONSUMIDA (no "hasta el monto del evento") | El progreso del objetivo puede caer a 0 de golpe con un gasto chico |
| `G14` | `AnularEventoFinanciero` no "des-consume" reservas | Anular un gasto que consumió reservas no las revive |
| `G21` | Sin importación automática de tipos de cambio | Hay que cargar cada tasa a mano |
| `G16` | El "ahorro real" del presupuesto es `ingresos − gastos`, no lo reservado | Mezcla dos conceptos que el dominio separa |

---

## Cómo esto estructura la app (la conclusión de UI/UX)

El dominio ya tiene la respuesta a "cómo organizar la información". Tres ejes:

### 1. "Realidad" vs "Planificación" — separación visible en todas partes
El dominio es **tajante**: eventos / valorizaciones / ajustes **son** patrimonio;
reservas / asignaciones / objetivos / presupuestos / programados **no tocan**
patrimonio (`DDD §Q`, `REQUISITES §E/H/L`). La app ya lo insinúa con la tab
**Planificar**, pero el detalle de un elemento las **mezcla**: hay que separar
- **"Movimientos"** (real, mueve el saldo) y
- **"Reservado"** (planificación, aparta del saldo libre)
en secciones visualmente distintas — y nunca meter una reserva en la lista de
movimientos. (§A1, §A2)

### 2. "Disponibilidad" como pregunta de primer nivel
`REQUISITES §H` eleva **valor libre** a métrica obligatoria. La pregunta cotidiana
del usuario no es "¿cuánto tengo?" sino **"¿de cuánto puedo disponer sin romper
mis metas?"**. Eso pide:
- en el Inicio: `Líquido · Reservado · Libre` (hoy solo hay "Líquido"),
- en cada cuenta: `vigente − reservado = libre` + qué metas lo comprometen. (§A1)

### 3. Confianza = trazabilidad visible
`REQUISITES §P` trata la auditoría como parte de la **integridad**, no como un
extra. Para una app **familiar** (varias personas tocando elementos compartidos)
esto es central y hoy está 100% invisible:
- "Historial de cambios" en cada entidad (quién, cuándo, antes/después), (§A5)
- distinguir "editar" de "corregir" cuando corresponde, (§A4)
- colapsar el par corrección+original en la lista. (§A9)

### Orden sugerido de trabajo

**Sin decisiones (solo UI + endpoints de lectura) — HECHO (Fases 29–30):**
1. ✅ Disponibilidad financiera en elemento + Inicio (§A1, §A2).
2. ✅ Historial de auditoría por entidad (§A5).
3. ✅ Pantalla de Asignaciones, incluye independientes (§A7).
4. ✅ Cambiar propiedad post-creación (§A3).
5. ✅ Colapso visual corrección+original (§A9).
6. ✅ Patrimonio / valor de elemento a una fecha puntual (§A6).

**Necesitan decisión tuya primero (lo que queda):**
7. **Visibilidad granular** (§B1) — desbloquea "transferir a otro miembro" (§A8) y
   el uso real en hogar. Es la decisión de mayor impacto.
8. Movimiento Programado con tipo (gasto/transferencia) (§B5).
9. Info adicional de Deuda/Crédito (§B3).
10. Estado operativo formal de Deuda/Crédito (§B2).
11. "Editar" vs "corregir" para el usuario final (§A4).
12. Guía proactiva hacia Crédito (§A10) y consistencia multi-hogar (§A11).
