# Recorrido de escenarios — Sesión 01 (Fase B de G33)

**Objetivo de este archivo:** recorrer, desde el código real de la app, cada
escenario T1 y T2 del catálogo de `USABILIDAD_REAL_S01.md` §5, como lo haría un
usuario nuevo, y medir cuánto le cuesta. Es la entrada de la Fase C
(benchmark).

- **Ubicación en el repo:** `Docs/usabilidad/RECORRIDO_ESCENARIOS_S01.md`
- **Fecha:** 2026-09-29 · **Línea base:** `main` en `f0ae411` (incluye la
  corrección de BUG-HOG, `63005d1`).
- **Método:** solo lectura. Rutas sacadas de `app/src/screens` (llamadas
  `nav.go()`, textos visibles) y reglas verificadas en `api/src` cuando §5
  marcaba *(verificar)*. No se tocó código ni datos.
- **Formato:** el de `USABILIDAD_REAL_S01.md` §8.

---

## 0. Notas previas

**Cantidad de escenarios.** §5 dice "29 escenarios T1/T2", pero el catálogo
validado tiene **28** (14 T1 y 14 T2) y **5** T3 (M11, A8, H6, C3, C4): 33 en
total. Este documento recorre los 28. No se agregó ni quitó ningún escenario;
si falta uno, hay que decidir cuál es.

**Cómo se cuenta.**
- *Pantallas:* pantallas distintas que el usuario atraviesa, incluida la de
  partida. Un asistente por pasos cuenta como una pantalla (los pasos se
  anotan aparte).
- *Decisiones:* elecciones que el usuario tiene que hacer (tipo, cuenta,
  categoría, sí/no), aunque tengan un valor por defecto que haya que revisar.
- *Campos obligatorios:* los que la app exige para enviar.
- *Términos de dominio expuestos:* palabras de sistema que aparecen en el
  camino y que un usuario común no usaría para describir el escenario.

Los conteos son aproximados (lectura de código, no cronómetro), pero se
aplicaron con el mismo criterio a todos los escenarios, así que sirven para
comparar.

**Rutas de entrada comunes.**
- *Registrar movimiento:* Tab Movimientos → botón `+` (un toque), o Tab Inicio
  → botón `+` → menú → "Registrar movimiento" (dos toques).
- *Agregar cuenta o bien:* Tab Inicio → `+` → "Agregar cuenta o bien", o
  "Primeros pasos", o Inicio → Mi patrimonio → "Agregar cuenta o bien".
- *Detalle de una cuenta:* Tab Inicio → tocar el total o "Composición" →
  Mi patrimonio → la cuenta.

**Anatomía de "Registrar movimiento"** (se usa en 13 escenarios; se describe
una vez). Es una sola pantalla larga, en este orden:
1. "Desde una plantilla" (si hay) o el enlace "¿Registras siempre lo mismo?
   Crea una plantilla".
2. Tipo: `Ingreso · Gasto · Transferencia · Conversión de moneda` (por defecto,
   Gasto).
3. Un aviso fijo según el tipo: en **Gasto**, "¿Alguien más puso parte?
   Registra primero una transferencia desde su cuenta a la tuya…"; en
   **Ingreso**, "¿Te van a devolver este dinero, o es de un tercero…? No lo
   registres como ingreso… Créalo como un Crédito (te deben) o una Deuda tipo
   'encargo'", con un enlace.
4. Monto, Fecha (hoy por defecto), Detalle (opcional).
5. Categoría (opcional): **la lista completa** de categorías y subcategorías,
   una fila por categoría, sin scroll interno (HZ-3).
6. Buscador de cuentas (solo si hay más de 6).
7. "Desde (origen)" y/o "Hacia (destino)": **todos** los elementos propios
   (cuentas, inversiones, deudas, créditos, inmuebles), con su saldo. En
   Transferencia la misma lista aparece dos veces, y debajo "De otro miembro
   del hogar".
8. Etiquetas (opcional) → "Registrar".

Consecuencia transversal: la cuenta, que es uno de los cuatro datos del modelo
mental del usuario (§3), queda al final, debajo de la lista completa de
categorías.

---

## 1. Movimientos — el día a día

### M1 — Gasté 10.000 en un helado el 18-sep con mi CuentaRUT
**Ruta real:** Tab Movimientos → `+` → Registrar movimiento → Registrar
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Movimientos | Toca `+` | — | — |
| 2 | Registrar movimiento | Enlace a plantillas arriba; Tipo ya en Gasto | "plantilla", "Conversión de moneda" | Conversión (T3) compite al mismo nivel que Gasto (T1). |
| 3 | Registrar movimiento | Aviso "¿Alguien más puso parte? Registra primero una transferencia…" | "transferencia" | Aparece en **todos** los gastos, para un caso T2 (HZ-2a). |
| 4 | Registrar movimiento | Monto; cambia la fecha de hoy al 18-sep | — | — |
| 5 | Registrar movimiento | Categoría: lista completa, sin scroll interno | — | Empuja la cuenta fuera de la vista (HZ-3). |
| 6 | Registrar movimiento | "Desde (origen)": todas sus cuentas, deudas y bienes | "origen" | Mezcla la CuentaRUT con deudas e inmuebles. |
**Conteo:** pantallas: 2 · decisiones: 4 · campos obligatorios: 2 · términos de dominio expuestos: 4
**¿Se puede completar?** Sí.
**¿El dominio lo soporta?** Sí (GASTO).
**Hallazgos relacionados:** HZ-2a, HZ-3, HZ-15, HZ-17.

### M2 — Me llegó el sueldo a la cuenta corriente
**Ruta real:** Tab Movimientos → `+` → Registrar movimiento (Tipo: Ingreso) → Registrar
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Registrar movimiento | Cambia el tipo a Ingreso | — | — |
| 2 | Registrar movimiento | Aviso "No lo registres como ingreso… Créalo como un Crédito o una Deuda tipo encargo" | "Crédito", "Deuda", "encargo" | Advertencia sobre un caso T2 en un registro T1; siembra duda sobre si el sueldo "es ingreso". |
| 3 | Registrar movimiento | Monto, fecha, categoría | — | Lista de categorías sin scroll interno (HZ-3). |
| 4 | Registrar movimiento | "Hacia (destino)": todos los elementos propios | "destino" | — |
**Conteo:** pantallas: 2 · decisiones: 4 · campos obligatorios: 2 · términos de dominio expuestos: 5
**¿Se puede completar?** Sí.
**¿El dominio lo soporta?** Sí (INGRESO).
**Hallazgos relacionados:** HZ-3, HZ-15.

### M3 — Paso plata de mi cuenta corriente a mi CuentaRUT
**Ruta real:** Tab Movimientos → `+` → Registrar movimiento (Tipo: Transferencia) → Registrar
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Registrar movimiento | Cambia el tipo a Transferencia | "Transferencia" (aceptable) | — |
| 2 | Registrar movimiento | "Desde (origen)" y "Hacia (destino)": la misma lista completa dos veces | "origen", "destino" | Lista duplicada y larga; con muchas cuentas, mucho scroll. |
| 3 | Registrar movimiento | Monto y Registrar | — | Si las cuentas tienen monedas distintas, el error llega al enviar y dice "Transferencia entre monedas distintas es una CONVERSION". |
**Conteo:** pantallas: 2 · decisiones: 3 · campos obligatorios: 3 · términos de dominio expuestos: 4
**¿Se puede completar?** Sí.
**¿El dominio lo soporta?** Sí (TRANSFERENCIA entre cuentas propias).
**Hallazgos relacionados:** HZ-3, HZ-17.

### M4 — Le transfiero a mi pareja para que pague Netflix
**Ruta real:** Tab Movimientos → `+` → Registrar movimiento (Tipo: Transferencia) → "De otro miembro del hogar" → Registrar
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Registrar movimiento | Tipo Transferencia; elige su cuenta en "Desde" | "origen" | — |
| 2 | Registrar movimiento | Busca la cuenta de la pareja bajo "De otro miembro del hogar" | "destino" | La sección solo aparece si la pareja marcó "¿El hogar puede ver que esta cuenta existe? = Sí". Si no, no aparece nada y la pantalla no explica por qué. |
| 3 | Registrar movimiento | Monto y Registrar | — | — |
**Conteo:** pantallas: 2 · decisiones: 3 · campos obligatorios: 3 · términos de dominio expuestos: 4
**¿Se puede completar?** Sí con conocimiento previo: depende de una configuración que hizo la otra persona en otra pantalla.
**¿El dominio lo soporta?** Sí (TRANSFERENCIA a un co-miembro, `GAPS.md` G6).
**Hallazgos relacionados:** HZ-10, D-2.

### M5 — Pago cuentas fijas (luz, Spotify) todos los meses
**Ruta real (a, plantilla):** Tab Planificar → Plantillas de movimiento → "Nueva plantilla" → Guardar; y cada mes: Tab Movimientos → `+` → tocar la plantilla → revisar fecha → Registrar.
**Ruta real (b, programado):** Tab Planificar → Movimientos programados → formulario → Programar; y cada mes: detalle → "Materializar ahora".
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Planificar | Dos entradas: "Movimientos programados" y "Plantillas de movimiento" | "programado", "plantilla" | Tiene que entender la diferencia antes de elegir. |
| 2a | Plantillas | Nombre, Tipo, Monto, Desde, Categoría, Detalle | "plantilla" | El registro mensual sigue siendo manual. |
| 2b | Movimientos programados | Tipo, Monto planificado, Fecha, Cuenta de origen, Observaciones | "planificado", "materializar" | **No hay recurrencia**: uno por mes. No tiene categoría. Cada uno se "materializa" a mano. |
| 3 | Registrar movimiento | Toca la plantilla; se llenan los campos | — | La plantilla no fija la fecha; hay que revisarla. |
**Conteo:** pantallas: 4 · decisiones: 7 · campos obligatorios: 4 · términos de dominio expuestos: 4
**¿Se puede completar?** Sí con conocimiento previo. "Todos los meses" no existe como tal: se resuelve registrando a mano cada mes.
**¿El dominio lo soporta?** Parcial: GASTO y plantilla, sí. `CrearMovimientoProgramado` no tiene periodicidad (verificado en `api/src/movimiento-programado`: no hay campo de recurrencia).
**Hallazgos relacionados:** HZ-16.

### M6 — Compro con la tarjeta de crédito y después pago la tarjeta
**Ruta real (compra):** Tab Movimientos → `+` → Registrar movimiento (Gasto) → "Desde": la tarjeta → Registrar.
**Ruta real (pago):** Tab Inicio → Mi patrimonio → la tarjeta → "Registrar pago" → Registrar movimiento (Transferencia, destino ya elegido) → "Desde": la cuenta → Registrar.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Registrar movimiento | Gasto; en "Desde (origen)" elige la tarjeta, que aparece con saldo negativo junto a las cuentas | "origen" | Nada indica que la compra con tarjeta se registra eligiendo la tarjeta como origen. |
| 2 | Mi patrimonio → Detalle | Busca la tarjeta (en la sección Deuda) | "Deuda" | Tres pantallas para llegar al botón de pago. |
| 3 | Detalle | "Registrar pago" | — | Buen atajo: preelige Transferencia y destino. |
| 4 | Registrar movimiento | Elige la cuenta de origen y el monto | "Transferencia", "destino" | Si entra por `+` en vez de por el detalle, tiene que saber que pagar la tarjeta es una transferencia hacia la deuda. |
**Conteo:** pantallas: 5 · decisiones: 5 · campos obligatorios: 4 · términos de dominio expuestos: 4
**¿Se puede completar?** Sí con conocimiento previo (la compra; el pago es descubrible desde el detalle).
**¿El dominio lo soporta?** Sí. Se resuelve el *(verificar)*: `RegistrarEventoFinanciero` GASTO acepta una DEUDA como origen (solo exige propiedad y moneda); el impacto negativo aumenta la deuda y `valor_pendiente` se deriva como |valor vigente|. El pago es TRANSFERENCIA hacia la deuda y la reduce.
**Hallazgos relacionados:** HZ-17.

### M7 — Compro algo para la casa y mi pareja me pasa su parte
**Ruta real:** (pareja, en su teléfono) Tab Movimientos → `+` → Transferencia → "Desde": su cuenta → "De otro miembro del hogar": mi cuenta → Registrar; (yo) Tab Movimientos → `+` → Gasto por el total → Registrar.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Registrar movimiento (yo) | Aviso de Gasto: "Registra primero una transferencia desde su cuenta a la tuya" | "transferencia" | La instrucción no se puede cumplir desde mi teléfono: "Desde" solo lista mis cuentas (el backend exige ser propietario del origen). No dice que lo registra la otra persona (HZ-2b). |
| 2 | Registrar movimiento (pareja) | Transferencia; su cuenta como origen; mi cuenta en "De otro miembro del hogar" | "origen", "destino" | Solo funciona si mi cuenta es visible para el hogar (HZ-10). |
| 3 | Registrar movimiento (yo) | Gasto por el total desde mi cuenta | — | "Primero" sugiere un orden que el dominio no exige. |
**Conteo:** pantallas: 4 (2 por persona) · decisiones: 7 · campos obligatorios: 5 · términos de dominio expuestos: 5
**¿Se puede completar?** No, sin coordinación fuera de la app: la persona que lee la instrucción no puede ejecutarla y la app no le dice quién debe hacerlo.
**¿El dominio lo soporta?** Sí (patrón "transferencia primero", `GAPS.md` G30-F8).
**Hallazgos relacionados:** HZ-2a, HZ-2b, HZ-10.

### M8 — Noira me transfiere 30.000 para que le compre un labial y se lo compro
**Ruta real (la que sugiere la app):** Tab Movimientos → `+` → Tipo Ingreso → aviso → "Crear un crédito o una deuda" → Agregar cuenta o bien (pasos 1–3) → vuelve a Registrar movimiento; al comprar: Tab Inicio → Mi patrimonio → la deuda → "Registrar pago" → Registrar movimiento.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Registrar movimiento | Elige Ingreso (la plata entró) y ve "No lo registres como ingreso" | "Crédito", "Deuda", "encargo" | La app la manda a otra pantalla en medio del registro. |
| 2 | Agregar (paso 1) | Llega con **"Crédito por cobrar"** ya elegido | "Crédito por cobrar" | Este caso es una Deuda (la plata es de Noira), no un crédito. Tiene que cambiarlo en "¿Qué es?". |
| 3 | Agregar (paso 1) | "Tipo": ninguno sirve para un encargo (hay "Préstamo a un tercero", "Crédito de consumo"…) | "Tipo", "Deuda" | Tiene que usar "Otro…" o crear un tipo nuevo. |
| 4 | Agregar (paso 2) | Moneda, fecha, "Monto que debes", "¿Qué tipo es? Financiera / Encargo o custodia", Acreedor, Fecha de término, Cuota | "Financiera", "custodia", "Acreedor", "Cuota" | Siete campos para "Noira me pasó 30.000". |
| 5 | Agregar (paso 3) | ¿De quién es? ¿El hogar puede verla? ¿Y el saldo? | "visibilidad" implícita | Preguntas sin relación con el escenario. |
| 6 | Registrar movimiento | Vuelve al formulario de Ingreso a medio llenar | — | **Contradicción:** la deuda nació con 30.000 pendientes, pero los 30.000 todavía no entraron a Falabella. La única forma de registrarlos es… un Ingreso, lo que el aviso le acaba de prohibir. Una transferencia desde la deuda la duplicaría a 60.000. |
| 7 | Detalle de la deuda → Registrar movimiento | Al comprar el labial: "Registrar pago" (transferencia de Falabella a la deuda) | "Transferencia", "destino" | Nada le dice que la compra **no** es un gasto, sino el pago de la deuda. |
**Conteo:** pantallas: 6 (el asistente tiene 3 pasos) · decisiones: 11 · campos obligatorios: 8 · términos de dominio expuestos: 10
**¿Se puede completar?** No. La guía de la app se contradice (paso 6) y el paso clave (compra = pago de la deuda) no se anuncia en ninguna parte. Coincide con lo que le pasó a Zoily (HZ-1).
**¿El dominio lo soporta?** Parcial. El patrimonio cuadra con INGRESO + Deuda + TRANSFERENCIA a la deuda (el "camino correcto" de `Docs/mockup/casos-dominio-probados.html` F3), pero ese camino infla los ingresos del mes. `RegistrarElementoPatrimonial` exige `valorPendiente > 0` en DEUDA/CREDITO y no mueve plata de ninguna cuenta, así que no existe un camino sin INGRESO (ver HZ-11).
**Hallazgos relacionados:** HZ-1, HZ-11, HZ-12, HIP-2, D-3.

### M9 — Juan me pasa 100.000 para mi papá; se los envío y agrego 100.000 míos
**Ruta real:** (Juan, en su teléfono) Transferencia → "De otro miembro del hogar": la Falabella de Zoily → Registrar; (Zoily) Tab Movimientos → `+` → Gasto 200.000 desde Falabella → Registrar.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Registrar movimiento (Juan) | Transferencia a una cuenta de Zoily | "origen", "destino" | Requiere que la cuenta de Zoily sea visible (HZ-10). |
| 2 | Registrar movimiento (Zoily) | Gasto por 200.000; aviso "¿Alguien más puso parte?" | "transferencia" | El aviso calza a medias: habla de "aportes", no de "plata de paso". |
| 3 | Movimientos (Zoily) | Ve un gasto de 200.000 | — | Sus gastos del mes suben 200.000, aunque 100.000 eran de Juan. No queda registrado que esa parte "era de paso". |
**Conteo:** pantallas: 4 (2 por persona) · decisiones: 6 · campos obligatorios: 5 · términos de dominio expuestos: 5
**¿Se puede completar?** Sí con conocimiento previo (Juan tiene que registrar su parte en su teléfono).
**¿El dominio lo soporta?** Parcial, como dice §5: el neto cuadra, pero la parte "de paso" no queda explícita.
**Hallazgos relacionados:** HZ-2b, HIP-2, D-3.

### M10 — Le compro algo a mis papás y me devuelven (mismo mes u otro)
**Ruta real:** Tab Movimientos → `+` → Gasto → Registrar; al recibir la devolución: Tipo Ingreso → aviso → "Crear un crédito o una deuda" → Agregar (Crédito por cobrar) → …; o, si ya existe el crédito: Inicio → Mi patrimonio → el crédito → "Registrar cobro".
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Registrar movimiento | Al comprar, elige Gasto; el aviso de Gasto habla de "aportes", no de "me lo devuelven" | — | La sugerencia de Crédito vive solo en Ingreso: llega **cuando la devolución ya ocurrió** y el gasto ya se registró. |
| 2 | Agregar (pasos 1–3) | "Crédito por cobrar", "Monto que te deben", "Financiera / Encargo o custodia", Deudor, Cuota | "Crédito por cobrar", "Deudor", "Financiera", "custodia", "Cuota" | Mismo asistente largo que M8. |
| 3 | Registrar movimiento | ¿Y la compra? Para que la cuenta baje sin contar como gasto solo queda una transferencia hacia el crédito, que lo duplicaría | — | Misma contradicción que M8 (HZ-11). |
| 4 | Detalle del crédito | "Registrar cobro" → Transferencia desde el crédito a la cuenta | "Transferencia", "origen" | Este tramo sí está bien resuelto. |
**Conteo:** pantallas: 5 · decisiones: 9 · campos obligatorios: 7 · términos de dominio expuestos: 9
**¿Se puede completar?** No sin inflar los gastos (o los ingresos). El usuario termina con Gasto + Ingreso, que es justo lo que `UX_FLOWS` Flujo 1 paso 6 quería evitar.
**¿El dominio lo soporta?** Parcial: el cobro, sí. El alta del crédito exige `valorPendiente > 0` sin mover plata de la cuenta, así que la compra no tiene contrapartida sin GASTO (HZ-11).
**Hallazgos relacionados:** HZ-11, HZ-12, HIP-2, D-3.

### M12 — Me equivoqué en un monto y lo corrijo
**Ruta real:** Tab Movimientos → tocar el movimiento → Movimiento → "Corregir" → Guardar corrección
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Movimiento | Botones "Corregir", "Anular movimiento", "Guardar como plantilla", "Editar etiquetas", con ayuda que explica Corregir y Anular | "Anular", "corrección" | — |
| 2 | Movimiento (formulario) | Monto correcto, Fecha correcta, Detalle, **Motivo** (mínimo 3 letras) | "Motivo" | Pedir un motivo para arreglar un error de tipeo es fricción; se entiende por la auditoría. |
**Conteo:** pantallas: 2 · decisiones: 1 · campos obligatorios: 2 · términos de dominio expuestos: 3
**¿Se puede completar?** Sí. Si el error es de cuenta o de tipo, hay que anular y registrar de nuevo (lo dice la ayuda).
**¿El dominio lo soporta?** Sí (`CorregirEventoFinanciero`).
**Hallazgos relacionados:** —

### M13 — Registré algo que no pasó y lo borro
**Ruta real:** Tab Movimientos → tocar el movimiento → Movimiento → "Anular movimiento" → Motivo → Anular
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Movimiento | "Anular movimiento" (botón rojo) | "Anular" | El usuario busca "Borrar" o "Eliminar". |
| 2 | Movimiento (formulario) | Motivo (mínimo 3 letras) → Anular | — | — |
**Conteo:** pantallas: 2 · decisiones: 1 · campos obligatorios: 1 · términos de dominio expuestos: 1
**¿Se puede completar?** Sí. Excepción: el saldo inicial de una cuenta no se anula (el backend lo rechaza y sugiere un ajuste).
**¿El dominio lo soporta?** Sí (`AnularEventoFinanciero`).
**Hallazgos relacionados:** —

---

## 2. Metas y ahorro

### A1 — Transfiero plata de mi cuenta a Fintual, a mi meta Hogar
**Ruta real:** (1) Tab Movimientos → `+` → Transferencia Falabella → Fintual → Registrar; (2) Tab Planificar → meta "Hogar" → Objetivo → "Apartar dinero" → cuenta Fintual → monto → Apartar.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Registrar movimiento | Transferencia, origen y destino | "origen", "destino" | No hay forma de decir "para mi meta Hogar". |
| 2 | Planificar → Objetivo | Panel "Apartar dinero" con la ayuda: "No sale de la cuenta: sigue ahí, pero queda comprometida" | "Apartar", "objetivo" | Contradice el modelo mental (§3, caso 6): para el usuario la plata **sí** se movió. |
| 3 | Objetivo | "¿De qué cuenta?": lista con el **saldo total**, no el disponible | — | Puede elegir una cuenta ya apartada al 100% y el error llega al confirmar (HZ-4). |
| 4 | Objetivo | Monto → "Apartar dinero" | "apartado" | Si solo hace el paso 1, la meta no avanza. Si solo hace el 2 desde Falabella, la plata no se mueve. Nada conecta los dos. |
**Conteo:** pantallas: 4 · decisiones: 5 · campos obligatorios: 5 · términos de dominio expuestos: 5
**¿Se puede completar?** No sin conocimiento previo: tiene que saber que son dos operaciones, en dos pestañas, en ese orden.
**¿El dominio lo soporta?** Sí, por partes (TRANSFERENCIA + `CrearAsignacion`/`CrearReserva`). Falta la orquestación (D-1).
**Hallazgos relacionados:** HZ-4, HZ-7, HZ-8, HIP-3, HIP-4, D-1, D-4.

### A2 — Fin de mes: junto lo que sobra de dos cuentas y lo mando a la meta
**Ruta real:** Tab Inicio (mirar cuánto sobra) → Mi patrimonio → cada cuenta (Disponible); luego A1 dos veces (dos transferencias) y un apartado en el destino.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Inicio / Detalle de cuenta | Para saber "lo que sobra" por cuenta tiene que entrar a cada detalle ("Disponible") | "Disponible", "Apartado" | Inicio muestra el disponible total, no por cuenta. |
| 2 | Registrar movimiento ×2 | Dos transferencias completas | "origen", "destino" | Repite todo el formulario. |
| 3 | Objetivo | Apartar la suma en la cuenta destino | "Apartar" | Mismo quiebre que A1, multiplicado. |
**Conteo:** pantallas: 5 · decisiones: 8 · campos obligatorios: 8 · términos de dominio expuestos: 5
**¿Se puede completar?** No sin conocimiento previo (igual que A1, con el doble de pasos).
**¿El dominio lo soporta?** Sí, por partes (2 × TRANSFERENCIA + reserva). Falta la orquestación (D-1).
**Hallazgos relacionados:** HZ-8, D-1.

### A3 — ¿Cuánto llevo para la meta y cuánto me queda libre para gastar?
**Ruta real:** Tab Inicio → panel "Disponibilidad" y panel "Objetivos"; o Tab Planificar → lista de objetivos con avance.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Inicio | "Líquido · Apartado · Disponible", con la nota "'Apartado' es plata separada para tus metas" | "Líquido" | "Disponibilidad" solo se ve en "Míos"; con "Del hogar" desaparece. |
| 2 | Inicio / Planificar | Avance agregado de los objetivos; en Planificar, por meta | — | — |
**Conteo:** pantallas: 2 · decisiones: 0 · campos obligatorios: 0 · términos de dominio expuestos: 4
**¿Se puede completar?** Sí.
**¿El dominio lo soporta?** Sí (progreso del objetivo + valor libre).
**Hallazgos relacionados:** HIP-3.

### A4 — Mi Fintual rentó; actualizo cuánto vale
**Ruta real:** Tab Inicio → Mi patrimonio → Fintual → "Registrar valorización" → Valorizar → Registrar valorización
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Mi patrimonio → Detalle | Busca Fintual; ve "Registrar valorización" **solo si** la cuenta admite valorización. Siempre ve "Registrar ajuste". | "valorización", "ajuste" | Si creó Fintual como "Ahorro" o "Liquidez" (probable si la piensa como su ahorro de la meta), solo tiene el ajuste. |
| 2a | Valorizar | Nuevo valor, fecha opcional; ayuda clara | "Valor vigente" | — |
| 2b | Registrar ajuste | "El valor real es Menor/Mayor", "Diferencia", Motivo obligatorio | "ajuste", "Diferencia" | Tiene que calcular la diferencia en vez de escribir el valor nuevo. |
**Conteo:** pantallas: 4 · decisiones: 1 · campos obligatorios: 1 · términos de dominio expuestos: 3
**¿Se puede completar?** Sí con conocimiento previo. Si eligió el tipo "Fondo mutuo", la categoría queda en Inversión y la valorización se activa sola; si no, cae en el ajuste.
**¿El dominio lo soporta?** Sí. Se resuelve el *(verificar)*: la app ofrece **las dos** cosas. `RegistrarValorizacion` solo si `admiteValorizacion`; `RegistrarAjustePatrimonial` siempre. Además, el asistente de alta dice que "¿Se valoriza en el tiempo?" "no se puede cambiar después", pero Editar permite cambiarlo (`CambiarAdmiteValorizacion`) (HZ-14).
**Hallazgos relacionados:** HZ-14.

### A5 — Uso la plata de la meta (compro el pasaje de las vacaciones)
**Ruta real:** Tab Movimientos → `+` → Gasto desde la cuenta de la meta → Registrar; luego Tab Planificar → "Total apartado" → Apartados → el apartado → "Liberar" (con motivo).
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Registrar movimiento | Gasto; no hay ningún campo "para qué meta" | — | La operación "gastar la plata de la meta" no existe en la app. |
| 2 | Objetivo / Apartado | La meta sigue mostrando el dinero apartado, aunque ya se gastó | — | El avance de la meta queda inflado. |
| 3 | Apartados → Apartado | "Liberar" en la fila de la cuenta; Motivo | "Liberar", "apartado" | Tiene que adivinar que debe "liberar" algo que ya gastó. |
**Conteo:** pantallas: 5 · decisiones: 4 · campos obligatorios: 4 · términos de dominio expuestos: 5
**¿Se puede completar?** No: la app no expone la operación y el rodeo (gasto + liberar) no es descubrible.
**¿El dominio lo soporta?** Sí en el backend, **no en la app**. Se resuelve el *(verificar)*: `RegistrarEventoFinanciero` acepta `asignacionId` y aplica la política "Consumir reserva" (consumo parcial, notificación `RESERVA_CONSUMIDA`, recálculo del progreso); `RegistrarMovimientoScreen` nunca envía `asignacionId` y ninguna pantalla lo ofrece (HZ-13).
**Hallazgos relacionados:** HZ-13, HIP-3.

### A6 — Separo plata para algo sin moverla de mi cuenta (fondo virtual)
**Ruta real:** Tab Planificar → `+` → Objetivos (Nuevo objetivo) → Crear → tocar el objetivo → "Apartar dinero"; alternativa: Planificar → "Total apartado" → Apartados → "Crear apartado" (sin objetivo).
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Objetivos | Nombre, Monto objetivo, Moneda, ¿Compartir con el hogar? → Crear | "objetivo" | Tras crear, se queda en la lista; hay que tocar el objetivo para apartar. |
| 2 | Objetivo | "Apartar dinero": cuenta, monto | "Apartar" | Muestra el saldo, no el disponible (HZ-4). |
| — | Apartados | Existe un segundo concepto paralelo: "apartado sin objetivo" | "apartado" | Dos puertas para lo mismo (HIP-3). |
**Conteo:** pantallas: 3 · decisiones: 3 · campos obligatorios: 4 · términos de dominio expuestos: 3
**¿Se puede completar?** Sí. Es el único caso de ahorro con entrada directa (§3.1).
**¿El dominio lo soporta?** Sí (`CrearReserva` sobre la misma cuenta).
**Hallazgos relacionados:** HZ-4, HIP-3, D-4.

### A7 — Creamos una meta del hogar y aportamos los dos
**Ruta real:** (yo) Tab Planificar → `+` → Objetivos: "¿Compartir con el hogar? Sí" → Crear → tocar el objetivo → "Compartir con el hogar" → marcar a la pareja → "Guardar designados"; (pareja) Tab Hogar → "Objetivos del hogar" → el objetivo → "Apartar dinero".
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Objetivos | Compartir = Sí; nota "Podrás designar quiénes pueden modificarlo" | "designar" | — |
| 2 | Objetivo | Paso aparte: marcar miembros y "Guardar designados" | "designados" | Si lo omite, la pareja ve la meta pero no puede aportar ("no eres designado"). |
| 3 | Hogar → Objetivo (pareja) | "Apartar dinero" desde sus cuentas | "Apartar" | Mismo quiebre de A1 si la pareja transfiere a otra cuenta. |
**Conteo:** pantallas: 5 (3 + 2 de la pareja) · decisiones: 5 · campos obligatorios: 4 · términos de dominio expuestos: 4
**¿Se puede completar?** Sí con conocimiento previo (el paso de designados no se anuncia al crear).
**¿El dominio lo soporta?** Sí (objetivo compartido, designados, reservas de cada uno; G13).
**Hallazgos relacionados:** HZ-8, D-4.

---

## 3. Hogar

### H1 — ¿Cuánta plata tenemos como hogar?
**Ruta real:** Tab Inicio → selector "Del hogar" → total; o Tab Hogar → "Patrimonio del hogar".
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Inicio | Cambia "Míos" por "Del hogar"; ve "<hogar> · patrimonio" | "patrimonio" | Desde `63005d1` muestra un error si el endpoint falla (ya no un 0 falso). |
| 2 | Hogar | "Elementos en el patrimonio del hogar": solo las cuentas que **suman** | "consolidación" | Una cuenta nueva nunca suma: el asistente no pregunta por la consolidación y nace en "No" (D-2). Las cuentas visibles que no suman no aparecen en la pestaña (HZ-10). |
**Conteo:** pantallas: 2 · decisiones: 1 · campos obligatorios: 0 · términos de dominio expuestos: 3
**¿Se puede completar?** Sí con conocimiento previo: el número se ve, pero solo es correcto si alguien activó "¿Cuenta en el patrimonio del hogar?" cuenta por cuenta en Editar.
**¿El dominio lo soporta?** Sí (consolidado del hogar; HZ-6 cerrado).
**Hallazgos relacionados:** HZ-6, HZ-10, D-2.

### H2 — ¿Cuánto gastamos este mes, yo y el hogar?
**Ruta real:** Tab Inicio → panel "Flujo de <mes>" con el selector Míos / Del hogar; o Tab Movimientos → mismo selector → "Balance de <mes>".
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Inicio o Movimientos | Ingresos, gastos y balance; cambia el alcance | "Del hogar" | Qué movimientos entran en "Del hogar" depende de la consolidación (el feed de `MovimientosHogar` filtra por §M, G30); no se explica. En Inicio, si hay varias monedas, solo se muestra la primera. |
**Conteo:** pantallas: 1 · decisiones: 1 · campos obligatorios: 0 · términos de dominio expuestos: 2
**¿Se puede completar?** Sí.
**¿El dominio lo soporta?** Sí (resumen financiero por alcance).
**Hallazgos relacionados:** HZ-10.

### H3 — Juan programa una transferencia mensual a la Falabella de Zoily
**Ruta real:** Tab Planificar → Movimientos programados → Tipo Transferencia → "Cuenta de destino" → (no está la cuenta de Zoily). Alternativa: Plantillas → igual.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Movimientos programados | "Cuenta de destino (a dónde entra)": solo cuentas propias | "programado" | La cuenta de Zoily no aparece (HZ-5). Tampoco hay "mensual": uno por mes (HZ-16). |
| 2 | Plantillas | "Hacia (opcional)": solo cuentas propias | "plantilla" | Mismo bloqueo. |
| 3 | Registrar movimiento | Sí ofrece "De otro miembro del hogar" | — | Única salida: registrar a mano cada mes. |
**Conteo:** pantallas: 2 · decisiones: 4 · campos obligatorios: 4 · términos de dominio expuestos: 3
**¿Se puede completar?** No.
**¿El dominio lo soporta?** No: el backend exige propiedad del destino en plantillas (G24) y programados (G2), y los programados no son recurrentes. Ver D-5.
**Hallazgos relacionados:** HZ-5, HZ-16, D-5.

### H4 — Decido qué ve mi pareja de mis cuentas y qué suma al hogar
**Ruta real:** al crear: Agregar (paso 3) → "¿El hogar puede ver que esta cuenta existe?" → "¿También puede ver el saldo?"; después, por cada cuenta: Tab Inicio → Mi patrimonio → la cuenta → "Editar / estado" → Visibilidad → "Guardar visibilidad" → "¿Cuenta en el patrimonio del hogar?" → "Guardar".
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Agregar (paso 3) | Dos preguntas de visibilidad; solo aparecen si el hogar tiene más miembros | — | No pregunta si suma al hogar (D-2). |
| 2 | Editar | "Que existe / El monto / Los movimientos" × "Privada / Compartida / Familiar", "Compartir con" | "Que existe", "El monto", "Privada", "Compartida", "Familiar" | Lenguaje de sistema; el dueño nunca ve el efecto (HZ-10). |
| 3 | Editar | "¿Cuenta en el patrimonio del hogar?" con su propio botón Guardar | "consolidada" | Es una idea distinta de la visibilidad, en la misma pantalla y sin explicar la diferencia. |
**Conteo:** pantallas: 4 (por cada cuenta) · decisiones: 5 · campos obligatorios: 0 · términos de dominio expuestos: 7
**¿Se puede completar?** Sí con conocimiento previo; ni el autor lo entendió (HZ-10).
**¿El dominio lo soporta?** Sí (visibilidad por dato y participación en consolidación, independientes, §M).
**Hallazgos relacionados:** HZ-10, D-2.

### H5 — Tenemos una deuda juntos (hipotecario o auto) y la pagamos
**Ruta real:** Tab Inicio → `+` → Agregar cuenta o bien (Tipo "Crédito hipotecario" → Deuda; paso 2: monto que debes, naturaleza, acreedor, término, cuota; paso 3: "Compartida" + porcentajes) → Agregar; cada pago: Mi patrimonio → la deuda → "Registrar pago".
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Agregar (paso 1) | El tipo resuelve la categoría (Deuda) | "Tipo" | — |
| 2 | Agregar (paso 2) | "¿Qué tipo es? Financiera / Encargo o custodia", Acreedor, Cuota | "Financiera", "custodia", "Acreedor", "Cuota" | Para un hipotecario la pregunta de "encargo" sobra. |
| 3 | Agregar (paso 3) | "¿De quién es? Compartida", porcentajes que suman 100 | — | Claro. |
| 4 | Detalle → Registrar movimiento | "Registrar pago" preelige Transferencia hacia la deuda; cada uno paga desde su cuenta | "Transferencia" | — |
**Conteo:** pantallas: 4 · decisiones: 8 · campos obligatorios: 5 · términos de dominio expuestos: 6
**¿Se puede completar?** Sí.
**¿El dominio lo soporta?** Sí (DEUDA con co-propiedad por porcentaje + pagos).
**Hallazgos relacionados:** —

---

## 4. Cuentas y bienes

### C1 — Agrego mi cuenta Falabella con su saldo actual (prioridad HZ-9)
**Ruta real:** Tab Inicio → `+` → "Agregar cuenta o bien" (o "Primeros pasos") → paso 1 → Siguiente → paso 2 → Siguiente → paso 3 (solo si el hogar tiene más miembros) → Agregar.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Agregar (paso 1) | **Primero "Tipo"** (Cuenta corriente, Cuenta vista, Cuenta de ahorro, Efectivo, Fondo mutuo…), después la categoría, **al final el nombre** | "Tipo", "Liquidez" | El dato que ella tiene ("Falabella") va al final; el primer campo le pide una clasificación. Si el tipo sugiere la categoría, se muestra resuelta ("Categoría: Liquidez · Cambiar"); si no, aparece "¿Qué es?" con 6 categorías. |
| 2 | Agregar (paso 2) | Moneda (CLP), "¿Desde cuándo lo tienes? (opcional)", **"Valor inicial" = 0**, "¿Se valoriza en el tiempo?" + "No se puede cambiar después de crear el elemento" | "Valor inicial", "se valoriza" | "Valor inicial" no es "saldo actual". El 0 por defecto se acepta sin aviso: la cuenta queda creada con saldo 0. La advertencia de irreversibilidad asusta y es falsa (HZ-14). |
| 3 | Agregar (paso 3) | "¿De quién es?", "¿El hogar puede ver que esta cuenta existe?", "¿También puede ver el saldo?" | "que existe" | Tres preguntas sobre el hogar para agregar una cuenta propia. No pregunta si suma al hogar (D-2). |
| 4 | Agregar | Botón "Agregar" (en los pasos anteriores, "Siguiente" y "← Atrás") | — | Si sale a mitad, se pide confirmar el descarte. |
**Conteo:** pantallas: 2 (el asistente tiene 3 pasos) · decisiones: 8 · campos obligatorios: 3 · términos de dominio expuestos: 6
**¿Se puede completar?** Sí con conocimiento previo. Candidatos al abandono de Zoily (HZ-9), en orden de probabilidad: (1) el paso 3 con tres preguntas sobre el hogar sin relación con su objetivo; (2) "Valor inicial" y "se valoriza" con la advertencia de que no se puede cambiar; (3) empezar por "Tipo" en vez del nombre. La causa exacta solo se confirma observando a la usuaria.
**¿El dominio lo soporta?** Sí (`RegistrarElementoPatrimonial` + saldo inicial como evento `SALDO_INICIAL`, G29).
**Hallazgos relacionados:** HZ-9, HZ-10, HZ-14, D-2.

### C2 — Agrego mi tarjeta de crédito con lo que debo
**Ruta real:** Tab Inicio → `+` → Agregar cuenta o bien → Tipo "Tarjeta de crédito" (resuelve Deuda) → Nombre → paso 2 → paso 3 → Agregar.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Agregar (paso 1) | Tipo "Tarjeta de crédito" → "Categoría: Deuda" | "Deuda" | Bien resuelto (tipo sembrado en la migración 018). |
| 2 | Agregar (paso 2) | Moneda, fecha, "Monto que debes", "¿Qué tipo es? Financiera / Encargo o custodia", Acreedor, Fecha de término, Cuota | "Financiera", "custodia", "Acreedor", "Cuota" | Siete campos; "Encargo o custodia" no aplica a una tarjeta. No hay cupo ni fecha de facturación, que es lo que el usuario conoce de su tarjeta. |
| 3 | Agregar (paso 3) | Propiedad y visibilidad | "que existe" | Igual que C1. |
**Conteo:** pantallas: 2 (3 pasos) · decisiones: 9 · campos obligatorios: 4 · términos de dominio expuestos: 7
**¿Se puede completar?** Sí con conocimiento previo.
**¿El dominio lo soporta?** Sí (DEUDA `FINANCIERA` con `valorPendiente`).
**Hallazgos relacionados:** HZ-10.

---

## 5. Planificación

### P1 — Me pongo un presupuesto del mes y veo si me pasé
**Ruta real:** Tab Planificar → "Sin presupuesto vigente · Crea uno" → Presupuestos → formulario → Crear presupuesto → tocar el presupuesto → Presupuesto → "Editar rubros" → Presupuesto por rubro → Guardar rubros. Para ver si se pasó: alerta en Inicio ("Presupuesto de <mes> excedido"), Planificar o Presupuesto → "Presupuestado vs. real".
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Presupuestos | Tipo "Individual / Familiar", Periodicidad "Periódico / Específico", Intervalo, Moneda | "Periódico", "Específico", "Intervalo" | Cuatro decisiones antes de poner un monto. |
| 2 | Presupuestos | Ingresos esperados, Gastos esperados, Ahorro esperado | "Ahorro esperado" | El usuario piensa "gasto máximo del mes", no tres montos. |
| 3 | Presupuesto por rubro | Monto por categoría y "Ahorro por objetivo" | "rubro" | Paso aparte, necesario para saber en qué se pasó. |
| 4 | Inicio / Presupuesto | Alerta de exceso y comparación presupuestado vs. real | — | Bien resuelto. |
**Conteo:** pantallas: 4 · decisiones: 7 · campos obligatorios: 3 · términos de dominio expuestos: 6
**¿Se puede completar?** Sí con conocimiento previo.
**¿El dominio lo soporta?** Sí (presupuesto periódico + desviación por rubro).
**Hallazgos relacionados:** —

### P2 — Dejo anotado un pago futuro (arriendo, dividendo)
**Ruta real:** Tab Planificar → Movimientos programados → formulario → Programar; al llegar la fecha: tocar el programado → "Materializar ahora" → Materializar.
| Paso | Pantalla | Qué ve / qué debe decidir | Términos que un usuario común no entendería | Problema |
|------|----------|----------------------------|---------------------------------------------|----------|
| 1 | Movimientos programados | Tipo, Monto planificado, Fecha, Cuenta de origen, Observaciones | "planificado" | Sin categoría. |
| 2 | Movimiento programado | "Materializar ahora" → Monto efectivo, Fecha efectiva | "Materializar", "efectivo" | La ayuda lo explica ("recién ahí entra como un movimiento real"), pero la palabra es de sistema. No es recurrente (HZ-16). |
**Conteo:** pantallas: 3 · decisiones: 3 · campos obligatorios: 3 · términos de dominio expuestos: 3
**¿Se puede completar?** Sí.
**¿El dominio lo soporta?** Sí (movimiento programado + materializar).
**Hallazgos relacionados:** HZ-16.

---

## 6. T3 — solo se verifica que exista un camino

| ID | Escenario | ¿Existe camino? | Ruta |
|----|-----------|-----------------|------|
| M11 | Pagué algo en dólares / cambié plata | Sí | Registrar movimiento → "Conversión de moneda" (requiere la tasa en Inicio → Ajustes → Tipos de cambio). |
| A8 | Cumplí la meta / la quiero reabrir | Sí | Objetivo → "Estado" (En progreso / Completado / Cancelado) → "Cambiar estado". La política "Completar objetivo" también la cierra sola. |
| H6 | Invito a mi pareja / acepto la invitación | Sí | Hogar → Miembros y roles → "Invitar a alguien" (email); quien recibe: Hogar → Invitaciones recibidas → Aceptar (o desde Bienvenida si aún no tiene hogar). |
| C3 | Agrego el auto o la casa y actualizo su valor una vez al año | Sí | Agregar (Tipo "Propiedad" o "Vehículo" → Activo, se valoriza = Sí) → Detalle → "Registrar valorización". |
| C4 | Cerré una cuenta | Sí | Detalle → "Editar / estado" → Estado → Motivo → "Desactivar". |

---

## 7. Hallazgos nuevos de la Fase B (propuestos)

Numeración provisional, continúa la de §4 de `USABILIDAD_REAL_S01.md`. Juan
decide si se incorporan a ese documento y cuáles van a `GAPS.md`.

| ID | Área | Tipo | Hallazgo |
|----|------|------|----------|
| HZ-11 | Movimientos | DOMINIO | El alta de una Deuda o un Crédito exige `valorPendiente > 0` y no mueve plata de ninguna cuenta. La contrapartida (los 30.000 que entran en M8, la compra en M10) solo puede registrarse como INGRESO o GASTO, lo que infla el mes. El aviso de Ingreso ("no lo registres como ingreso") es imposible de cumplir. Afecta a M8 y M10; relacionado con D-3. |
| HZ-12 | Movimientos | UI | El enlace del aviso de Ingreso abre el asistente con "Crédito por cobrar" preelegido, aunque el caso típico (plata de un tercero, M8) es una Deuda. Además, ningún tipo sembrado sirve para un encargo. |
| HZ-13 | Metas | FLUJO | El backend soporta gastar la plata de una meta (`asignacionId` en `RegistrarEventoFinanciero`, política "Consumir reserva"), pero la app nunca lo envía ni lo ofrece. A5 no tiene entrada. |
| HZ-14 | Cuentas | UI | El asistente de alta dice que "¿Se valoriza en el tiempo?" no se puede cambiar después, pero Editar lo permite (`CambiarAdmiteValorizacion`). Advertencia falsa en el asistente que Zoily no terminó. |
| HZ-15 | Movimientos | UI | Los avisos de Gasto ("¿alguien más puso parte?") y de Ingreso ("¿te lo van a devolver?") aparecen en el 100% de los registros T1 para casos T2. Contradice §2 (lo raro no compite con lo frecuente). |
| HZ-16 | Planificación / Hogar | DOMINIO | Los movimientos programados no tienen recurrencia ni categoría. "Todos los meses" (M5, H3) se resuelve creando uno por mes o registrando a mano. |
| HZ-17 | Movimientos | UI | En Registrar movimiento, "Desde" y "Hacia" listan todos los elementos (cuentas, deudas, créditos, inmuebles) mezclados; en Transferencia, la misma lista aparece dos veces; y la cuenta queda debajo de la lista completa de categorías. Amplía HZ-3. |

---

## 8. Tabla resumen

Orden: primero por frecuencia (T1 antes que T2); dentro de cada grupo, de peor
a mejor según el veredicto (No → Sí con conocimiento previo → Sí) y, a igual
veredicto, según la suma del conteo (pantallas + decisiones + campos
obligatorios + términos).

| # | ID | Escenario | Frec. | Pant. | Decis. | Oblig. | Térm. | Suma | ¿Se completa? | ¿Dominio? |
|---|----|-----------|-------|-------|--------|--------|-------|------|---------------|-----------|
| 1 | **A2** ⚠ | Junto lo que sobra de dos cuentas y lo mando a la meta | T1 | 5 | 8 | 8 | 5 | 26 | No | Sí (falta D-1) |
| 2 | **M7** ⚠ | Compro algo para la casa y mi pareja me pasa su parte | T1 | 4 | 7 | 5 | 5 | 21 | No | Sí |
| 3 | **A1** ⚠ | Transfiero a Fintual, a mi meta Hogar | T1 | 4 | 5 | 5 | 5 | 19 | No | Sí (falta D-1) |
| 4 | H3 | Transferencia mensual a la Falabella de Zoily | T1 | 2 | 4 | 4 | 3 | 13 | No | No (D-5) |
| 5 | M5 | Cuentas fijas todos los meses | T1 | 4 | 7 | 4 | 4 | 19 | Sí c/ conocimiento | Parcial |
| 6 | M6 | Compro con tarjeta y la pago | T1 | 5 | 5 | 4 | 4 | 18 | Sí c/ conocimiento | Sí |
| 7 | M4 | Transfiero a mi pareja para Netflix | T1 | 2 | 3 | 3 | 4 | 12 | Sí c/ conocimiento | Sí |
| 8 | A4 | Mi Fintual rentó | T1 | 4 | 1 | 1 | 3 | 9 | Sí c/ conocimiento | Sí |
| 9 | H1 | ¿Cuánta plata tenemos como hogar? | T1 | 2 | 1 | 0 | 3 | 6 | Sí c/ conocimiento | Sí |
| 10 | M2 | Me llegó el sueldo | T1 | 2 | 4 | 2 | 5 | 13 | Sí | Sí |
| 11 | M1 | Gasté 10.000 en un helado | T1 | 2 | 4 | 2 | 4 | 12 | Sí | Sí |
| 12 | M3 | Paso plata entre mis cuentas | T1 | 2 | 3 | 3 | 4 | 12 | Sí | Sí |
| 13 | A3 | ¿Cuánto llevo y cuánto me queda libre? | T1 | 2 | 0 | 0 | 4 | 6 | Sí | Sí |
| 14 | H2 | ¿Cuánto gastamos este mes? | T1 | 1 | 1 | 0 | 2 | 4 | Sí | Sí |
| 15 | M8 | Encargo de Noira (labial) | T2 | 6 | 11 | 8 | 10 | 35 | No | Parcial (HZ-11) |
| 16 | M10 | Compro para mis papás y me devuelven | T2 | 5 | 9 | 7 | 9 | 30 | No | Parcial (HZ-11) |
| 17 | A5 | Uso la plata de la meta | T2 | 5 | 4 | 4 | 5 | 18 | No | Sí en backend, no en app |
| 18 | C2 | Agrego mi tarjeta con lo que debo | T2 | 2 | 9 | 4 | 7 | 22 | Sí c/ conocimiento | Sí |
| 19 | M9 | Juan me pasa 100.000 para mi papá | T2 | 4 | 6 | 5 | 5 | 20 | Sí c/ conocimiento | Parcial |
| 20 | P1 | Presupuesto del mes | T2 | 4 | 7 | 3 | 6 | 20 | Sí c/ conocimiento | Sí |
| 21 | C1 | Agrego mi cuenta Falabella (HZ-9) | T2 | 2 | 8 | 3 | 6 | 19 | Sí c/ conocimiento | Sí |
| 22 | A7 | Meta del hogar entre los dos | T2 | 5 | 5 | 4 | 4 | 18 | Sí c/ conocimiento | Sí |
| 23 | H4 | Qué ve mi pareja y qué suma al hogar | T2 | 4 | 5 | 0 | 7 | 16 | Sí c/ conocimiento | Sí |
| 24 | H5 | Deuda compartida y sus pagos | T2 | 4 | 8 | 5 | 6 | 23 | Sí | Sí |
| 25 | A6 | Fondo virtual en la misma cuenta | T2 | 3 | 3 | 4 | 3 | 13 | Sí | Sí |
| 26 | P2 | Pago futuro anotado | T2 | 3 | 3 | 3 | 3 | 12 | Sí | Sí |
| 27 | M12 | Corrijo un monto | T2 | 2 | 1 | 2 | 3 | 8 | Sí | Sí |
| 28 | M13 | Borro algo que no pasó | T2 | 2 | 1 | 1 | 1 | 5 | Sí | Sí |

A igual suma (M9 y P1) se mantiene el orden del catálogo.

### Los 3 flujos peores (para el mockup de la Fase D)

Aplicando la regla de §8 (T1 primero, luego de peor a mejor):

1. **A2** — junto lo que sobra y lo mando a la meta.
2. **M7** — compra para la casa con aporte de la pareja.
3. **A1** — transfiero a Fintual, a mi meta.

Observaciones para la Fase D (no cambian el resultado):
- **A1 y A2 son el mismo flujo** (A2 es A1 repetido). Un mockup de "Ahorrar
  para una meta" cubre los dos, lo que libera un lugar.
- **H3** es el siguiente T1 con "No", pero su bloqueo es de dominio (D-5 y
  HZ-16), no de presentación: no se arregla con un mockup.
- **M8** es el peor escenario de todo el catálogo (suma 35) aunque sea T2, y
  §6 ya lo incluye en la señal de validación de la Fase D (M1, M8, A1, M7).
  Si se libera el lugar de A2, M8 es el candidato natural.
- **C1** no sale entre los peores por conteo, pero es la puerta de todo lo
  demás (HZ-9): sin cuentas no se puede probar ningún otro escenario.
