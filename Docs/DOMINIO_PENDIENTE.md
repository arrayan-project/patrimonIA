# Dominio vs. implementación — qué falta y cómo guía la UI

Relectura completa de los 6 docs (`DDD`, `APPLICATION_SERVICES`, `DATABASE_DESIGN`,
`REQUISITES`, `UX_FLOWS`, `API_DESIGN`) contra el estado del código a la Fase 28.

**Resumen en una línea:** el modelo de dominio está **cerrado y los 52 comandos
están implementados**. Lo que falta es (A) **exponer en la UI conceptos que ya
existen en el backend**, (B) un puñado de **decisiones de dominio** que los propios
docs dejaron abiertas, y (C) asumir conscientemente unas **simplificaciones**
técnicas que hoy limitan la experiencia.

La conclusión para UI/UX está al final (§ "Cómo esto estructura la app").

> **Estado a Fase 46 (2026-09-05).** Todo el bloque §B con decisión tomada está
> implementado: **B6** (objetivos compartidos por hogar — Fase 43), **B7** (ahorro
> esperado por objetivo — Fase 41), **B8** (moneda como etiqueta en
> objetivo/asignación/presupuesto — Fase 45), **B9** (categorías jerárquicas —
> Fase 39), **B10** (fecha_alta/fecha_baja — Fase 42). Ver `GAPS.md` §2 para el
> detalle. Sin decidir aún: **B4** (comentarios/adjuntos). Ver más abajo el estado
> previo.
>
> **Estado a Fase 34 (2026-09-04).** Bloque §A: **A1, A2, A3, A5, A6, A7, A8, A9**
> implementados. El usuario decidió §B1, §B2, §B3 y §B5 (Fases 32–34); quedan
> **A4** (¿el usuario final distingue "editar" de "corregir"? — implementado como
> opción visible en Editar elemento, Fase 31, sin forzar la distinción), **A10**
> (guía proactiva hacia Crédito — diseño de UX, no pedido) y **A11** (consistencia
> multi-hogar — chore transversal, el usuario dijo que no por ahora). Quedan sin
> decidir: **B4** (comentarios/adjuntos), **B6** (objetivos/asignaciones
> familiares), **B7** (ahorro esperado en presupuesto), **B8** (moneda en
> reserva/asignación/objetivo/presupuesto), **B9** (categorías jerárquicas),
> **B10** (fechas de alta/baja para reconstrucción).

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

### A8 · Transferir a un elemento de otro miembro del hogar — ✅ HECHO (Fase 34; alta explícita Fase 50)
`UX_FLOWS` Flujo 1 paso 4 ("le transfiero a mi esposa para Netflix"). El backend
ya lo permitía (`evento.service #validarDestino`). Con §B1 resuelto, se agregó
`GET /elementos-patrimoniales?alcance=hogar` (elementos de co-miembros cuya
EXISTENCIA el actor puede ver) y el picker de destino en Registrar movimiento
(TRANSFERENCIA) los ofrece.
**Fase 50** — el bloqueo real era que todo elemento nacía `PRIVADA` en silencio,
así que la cuenta destino nunca aparecía para el otro miembro (F2 de
`Docs/mockup/casos-dominio-probados.html`). El wizard de alta ahora **pregunta**
la visibilidad (Control A: ¿el hogar ve que existe? · Control B: ¿ve el saldo?),
y `RegistrarElementoPatrimonial` acepta `visibilidadPorTipo` para aplicarlo en la
misma transacción (usa la granularidad de §B1, sin columnas nuevas).

### A8c · Saldo inicial de una cuenta = evento SALDO_INICIAL — ✅ HECHO (Fase 51)
`GAPS G29`. `valorInicial` de un elemento LIQUIDEZ/RESERVA ya no solo inicializa
`valor_vigente`: `RegistrarElementoPatrimonial` crea un `evento_financiero`
`SALDO_INICIAL` + impacto (fecha = `fecha_alta`) en la misma transacción, para que
la apertura de la cuenta cuente como ingreso del mes en `resumen-financiero`.
INVERSION/ACTIVO no lo generan. No es invocable a mano ni anulable/corregible.
Decisión de dominio explícita del usuario (había dos opciones: "disponible aparte"
vs. "cuenta como ingreso" — eligió la segunda).

### A8b · Transferencias visibles en Movimientos — ✅ HECHO (Fase 50)
`reporte.service` filtraba `resumen-financiero.movimientos` a INGRESO/GASTO, así
que una transferencia (entre miembros o hacia afuera) no aparecía en ningún lado
salvo el detalle de la cuenta — el patrimonio "bajaba sin explicación" (F1). Ahora
`movimientos` incluye TRANSFERENCIA/CONVERSION como filas neutras
(`efectoPropio` = impacto sobre las cuentas propias) que **no** suman a
`porMoneda`/`porRubro`. `MovimientoDetalle` muestra ambos lados ("Desde X → Hacia Y").

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

### B1 · Visibilidad granular por tipo de información — `GAPS G6` — ✅ RESUELTO (Fase 34)
`REQUISITES §M` define visibilidad **por tipo**: existencia · valor · movimientos ·
reservas/asignaciones · objetivos · presupuestos · comentarios · documentos. Y
tres niveles: Privada / Compartida / **Familiar**.

**Decisión del usuario**: implementarlo tal como se planteó. Migración 016:
`elemento_visibilidad` (nivel por EXISTENCIA/VALOR/MOVIMIENTOS — reservas,
objetivos y presupuestos quedan para cuando existan como conceptos compartibles)
+ `elemento_comparticion` (con quién, cuando el nivel es COMPARTIDA). El enum
base `visibilidad` sigue siendo el nivel por defecto de los tres tipos; compat:
COMPARTIDA sin lista explícita se comporta como FAMILIAR. Comando
`DefinirVisibilidadElementoPatrimonial`. `obtenerElemento` cierra EXISTENCIA
(404) y, sin VALOR, `valorOculto: true` + montos en 0. Los movimientos se abren
a co-miembros con visibilidad MOVIMIENTOS. Editar elemento tiene un editor por
tipo + selector de "compartir con". Desbloqueó **§A8**.

### B2 · Estado operativo de Deuda/Crédito — `GAPS G1` — ✅ RESUELTO (Fase 32)
**Decisión del usuario**: incluir los conceptos. Sigue **sin** columna
`estado_operativo` (fiel al DDD: "se deriva") — es un cálculo de lectura:
`VIGENTE` · `PARCIALMENTE_PAGADA` · `EN_MORA` · `SALDADA` · `CONDONADA` ·
`INCOBRABLE`, expuesto en `ElementoPatrimonialDTO.estadoOperativo`. Migración 014
agregó `valor_pendiente_inicial` para poder derivar "parcialmente pagada" sin
depender de la auditoría.

### B3 · Información adicional de Deuda/Crédito — `REQUISITES §J` — ✅ RESUELTO (Fase 32)
**Decisión del usuario**: sumar los campos al esquema. Migración 014: columnas
opcionales en `elemento_patrimonial` (no tabla hija) — `contraparte` (acreedor/
deudor), `fecha_inicio`, `fecha_termino`, `cuota_monto`, `tasa_interes`,
`observaciones`. Se capturan al crear (wizard) y se editan con
`ActualizarDatosElementoPatrimonial` / `CorregirDatosElementoPatrimonial`.

### B-custodia · Naturaleza de Deuda/Crédito: financiera vs. custodia informal — `GAPS G28` — ✅ RESUELTO (Fase 50)
**Problema**: el "caso de uso típico" (REQUISITES línea 430) — un amigo me
transfiere plata para que le compre algo — obliga a modelar ese dinero como un
Crédito/Deuda para que el patrimonio neto cuadre (la plata pasó por mis cuentas
pero no es mía). Sin distinción, queda mezclado con el hipotecario y las tarjetas.
**Decisión (Fase 50)**: columna `elemento_patrimonial.naturaleza`
(`FINANCIERA` | `CUSTODIA_INFORMAL`), NOT NULL para DEUDA/CREDITO (default
`FINANCIERA`), NULL en el resto (migración 023, CHECK `ck_naturaleza_valores` +
`ck_naturaleza_categoria`). Es un **atributo del comando
`RegistrarElementoPatrimonial`** cuando la categoría es DEUDA/CREDITO — mismo
patrón que `CondonarDeuda` vs `DeclararIncobrable`: distinción explícita en el
modelo, no un flag de UI. No hay comando nuevo, no cambia el patrimonio. El
wizard de alta lo pregunta; la app muestra los `CUSTODIA_INFORMAL` bajo "Encargos
y custodia", separados de las deudas/créditos financieros. Prosa para DDD §T y
DATABASE_DESIGN en `Docs/ADENDA-dominio-fases-50-51.md`.

### B4 · Comentarios y documentos adjuntos — `REQUISITES §M / §D`
Listados como tipos de información con visibilidad propia. **No modelados.**
`GAPS G22` propuso una tabla `comentario` polimórfica y se descartó por ahora
(se hizo `glosa` en el evento). Nada para adjuntar una boleta, un contrato, etc.

### B5 · Movimiento Programado: tipo, destino múltiple, visibilidad — `GAPS G2` — ✅ RESUELTO (Fase 33)
**Decisión del usuario**: incluirlos. Migración 015: `tipo`
(INGRESO/GASTO/TRANSFERENCIA) + `elemento_origen_id`; `elemento_destino_id` pasa
a nullable, CHECK amarra los slots al tipo. Materializar genera un Evento
Financiero del mismo tipo. Autorización: propietario de cada elemento referido.
Visibilidad/propiedad **sigue heredada** de los elementos (sin columnas propias,
como dejaba abierto DDD §S) — puede revisarse junto con §B1 más adelante.

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

### Orden sugerido de trabajo — HECHO

**Sin decisiones (Fases 29–31):**
1. ✅ Disponibilidad financiera en elemento + Inicio (§A1, §A2).
2. ✅ Historial de auditoría por entidad (§A5).
3. ✅ Pantalla de Asignaciones, incluye independientes (§A7).
4. ✅ Cambiar propiedad post-creación (§A3).
5. ✅ Colapso visual corrección+original (§A9).
6. ✅ Patrimonio / valor de elemento a una fecha puntual (§A6).
7. ✅ "Editar" vs "corregir" visible en Editar elemento, con miniguías por operación (§A4).

**Decisiones del usuario, implementadas (Fases 32–34):**
8. ✅ Info adicional de Deuda/Crédito (§B3).
9. ✅ Estado operativo derivado de Deuda/Crédito (§B2).
10. ✅ Movimiento Programado con tipo INGRESO/GASTO/TRANSFERENCIA (§B5).
11. ✅ Visibilidad granular por tipo de información + "compartido con quién" (§B1) —
    desbloqueó transferir a un elemento de otro miembro (§A8).

**Sin decisión tomada (el usuario dijo que no, o no se ha pedido):**
- §A10 guía proactiva hacia Crédito, §A11 consistencia multi-hogar (multihogar: no).
- §B4 comentarios/adjuntos, §B6 objetivos/asignaciones familiares, §B7 ahorro
  esperado en presupuesto, §B8 moneda en reserva/asignación/objetivo/presupuesto,
  §B9 categorías jerárquicas, §B10 fechas de alta/baja para reconstrucción.
