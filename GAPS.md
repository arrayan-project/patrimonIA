# Vacíos y decisiones pendientes

Formato tomado de `Docs/UX_FLOWS.docx` § "Resumen y vacíos detectados": qué se
necesita, por qué no está resuelto, qué opciones existen. Nada de esto se
resuelve inventando una regla de negocio (BUILD_INSTRUCTIONS §4).

---

## Heredados del diseño (documentados en los 6 docs, NO tocados en Fase 1)

### G1 — Estado operativo intermedio de Deuda/Crédito
- **Qué falta**: un valor entre "activa" y "pagada por completo" para mostrar en UI.
- **Por qué no está resuelto**: la Sección T del DDD dice que el estado "se deriva
  del valor pendiente" pero no enumera los valores intermedios.
- **Decisión (Fase 8)**: NO se introduce un estado formal nombrado. La política
  "Derivar estado operativo" se implementa como el mantenimiento del invariante
  `valor_pendiente == |valor_vigente|` tras cada impacto (ver G17). El "estado"
  (activa / parcial / saldada) es un **cálculo de lectura** que la UI hace con
  `valor_pendiente` y el pendiente inicial (de la auditoría de creación). No hay
  columna `estado_operativo`.
- **Para decidir**: ¿hace falta un enum formal para reporting/consolidación?

### G2 — Visibilidad / propiedad de Movimiento Programado
- **Qué falta**: definir si `movimiento_programado` lleva columnas de
  visibilidad/propiedad propias o hereda las del elemento destino.
- **Por qué no está resuelto**: DDD Sección S lo deja explícitamente para después
  ("Revisar si Movimiento Programado requiere reglas de visibilidad/propiedad
  propias o hereda las del Elemento Patrimonial destino").
- **Decisión provisional (Fase 7, técnica no de dominio)**: **hereda del elemento
  destino** — el actor debe ser propietario de `elemento_destino_id` para crear,
  actualizar, materializar, cancelar o ver el movimiento programado. No se agregan
  columnas al esquema. Es la lectura menos invasiva de las dos que plantea el DDD.
- **Otras simplificaciones de Fase 7**:
  - El esquema modela `elemento_destino_id` **singular** (AS #13 dice "elemento(s)
    destino"). Se usa singular.
  - No hay columna `tipo` en `movimiento_programado`. **Materializar genera un
    evento INGRESO** hacia el elemento destino (el caso natural de un movimiento
    con un único destino y monto planificado — ej. un abono recurrente).
    Gastos/transferencias programados quedan como extensión futura.
  - Materializar exige `fecha_programada <= hoy` y estado PENDIENTE. Escribe **una
    sola** entrada de auditoría (`comando = MaterializarMovimientoProgramado`,
    entidad = MOVIMIENTO_PROGRAMADO, relacionada = EVENTO_FINANCIERO) — no
    reutiliza la auditoría de `RegistrarEventoFinanciero` (AS #15: "único caso de
    uso compartido, se registra bajo el mismo comando").
- **Para decidir**: ¿MP con `tipo` y origen para programar gastos/transferencias?
  ¿reglas de visibilidad propias?

---

## Detectados durante la implementación de Fase 1

### G3 — `moneda_consolidacion` en CrearHogar
- **Qué falta**: el esquema exige `hogar.moneda_consolidacion` (NOT NULL), pero
  el comando `CrearHogar` (API_DESIGN A / AS #34) solo define `nombre` como input,
  y la pantalla "Crear Hogar" (UX_FLOWS) solo pide el nombre.
- **Decisión provisional**: el DTO acepta `monedaConsolidacion` opcional; si no
  viene, se usa el placeholder `"CLP"` (`MONEDA_PLACEHOLDER` en `hogar.service.ts`).
  Ajustable después con `CambiarMonedaConsolidacion` (AS #36, aún no implementado).
- **Por qué es aceptable**: es el mismo patrón que BUILD_INSTRUCTIONS §4 autoriza
  para el % de Deuda/Crédito — placeholder trivial + comentario en código.
  Bloquear todo el flujo vertical por la moneda inicial sería desproporcionado.
- **Para decidir**: ¿la pantalla de alta debería pedir la moneda?, ¿o el default
  es una regla de producto legítima ("hogar chileno → CLP")?

### G4 — "Token de sesión temporal de registro" para RegistrarUsuario
- **Qué falta**: API_DESIGN dice que `POST /comandos/RegistrarUsuario` va con un
  "token de sesión temporal de registro, no de usuario ya autenticado".
- **Estado (Fase 12 + 14c)**: **resuelto salvo el captcha**.
  - `POST /auth/registro-token` (anónimo, **rate-limit 10/hora por IP** —
    `RateLimiter` en memoria) emite un JWT `{ purpose: 'registro' }` de 15 min.
    Si se le pasa `email`, el token queda **ligado a ese email** y se **envía por
    correo** (`EmailSender` → `ConsoleEmailSender` por defecto; se cambia el
    provider `EMAIL_SENDER` por Resend/SES en prod).
  - En modo requerido (`AUTH_REGISTRO_TOKEN_REQUERIDO=true`) el token **no** se
    devuelve en la respuesta (`{ enviado: true }`), solo llega al email; y
    `RegistroTokenGuard` exige que el `email` del token coincida con el del alta.
  - En dev/test el endpoint devuelve el token directo y el guard no bloquea.
- **Pendiente**: el captcha / verificación anti-bot antes de emitir el token
  (rate-limit + email ya reducen el abuso; el captcha necesita elegir proveedor).
  Rate-limit en memoria → para varias instancias haría falta un store compartido.

### G6 — Visibilidad de elementos y propiedad compartida (Fase 2)
- **Qué falta**: el DDD (Sección M) define visibilidad "por tipo de información"
  (existencia, valor, movimientos, reservas...). El esquema colapsó eso a un solo
  enum `visibilidad` (PRIVADA/COMPARTIDA/FAMILIAR). No hay tabla "compartido con
  quién", así que COMPARTIDA y FAMILIAR se tratan igual.
- **Decisión provisional (Fase 2)**:
  - `GET /elementos-patrimoniales/:id` y `/impactos`: visibles para los
    propietarios; y para co-miembros de hogar si `visibilidad != PRIVADA`.
  - `GET /elementos-patrimoniales?propietario=X`: solo `X = actor`.
  - `RegistrarEventoFinanciero` TRANSFERENCIA: el actor debe ser propietario del
    origen; el destino debe ser propio o de un co-miembro de hogar.
  - `RegistrarElementoPatrimonial`: el actor debe figurar entre los propietarios
    declarados (no puede crear un elemento 100% ajeno). Cualquier co-propietario
    debe ser un usuario ACTIVO — no se exige (todavía) que comparta hogar.
- **Para decidir**: ¿visibilidad granular por tipo de info?, ¿tabla de
  "compartido con"?, ¿reglas de co-propiedad más estrictas?

### G7 — Proyecciones: en vivo vs. materializada
- **Qué falta**: DATABASE_DESIGN §12 y el comentario de `schema.sql` dejan
  pendiente si las proyecciones son vista SQL en vivo o tabla materializada
  (decisión de performance).
- **Decisión provisional**: **todas en vivo** desde la info primaria
  (Principio 1) — `patrimonio_individual`, `patrimonio_familiar_consolidado`,
  `progreso_objetivo`, `desviacion_presupuestaria`, métricas del hogar,
  reconstrucción histórica.
- **Resuelto en Fase 13**: el total consolidado entre monedas ya existe —
  `GET /hogares/:id/patrimonio-consolidado` devuelve `total` en la moneda del
  hogar usando `tipo_cambio` (migración 007), y `null` + `conversionesFaltantes`
  si falta alguna tasa. `patrimonio-individual` sigue siendo solo `porMoneda`
  (el usuario no tiene "moneda de consolidación" propia).
- **Para decidir**: materializar si el cálculo en vivo escala mal.

### G21 — Conversión monetaria (Fase 13 + 14c)
- `ConversionService` (Fase 13): tasa directa más reciente con
  `fecha_vigencia <= fecha`; si no hay, el inverso B→A (`1/tasa`).
- **Triangulación (Fase 14c)**: si tampoco hay inverso, se busca una moneda
  pivote C con A↔C y C↔B disponibles (máx. 2 saltos). Con varias pivotes se
  elige la primera alfabéticamente — determinista. Si no hay ninguna, la
  conversión falla (y el total consolidado queda `null`).
- `RegistrarTipoCambio` (comando nº 53) es dato global, inmutable; para
  "corregir" una tasa se registra otra con fecha de vigencia posterior.
- **Pendiente**: importación automática desde una fuente de tasas.

### G9 — CorregirEventoFinanciero: alcance del "datos corregidos" (Fase 3)
- **Qué falta**: AS #12 dice "datos corregidos" sin enumerarlos.
- **Decisión provisional (Fase 3)**: solo se corrige el **monto**. Cambiar tipo,
  fecha o elementos afectados requiere `AnularEventoFinanciero` + registrar de
  nuevo. Además la cadena de correcciones es lineal: no se puede corregir (ni
  anular) un evento que ya tiene una corrección viva — hay que actuar sobre la
  última corrección.
- **Para decidir**: ¿permitir corregir fecha?, ¿re-corregir encadenando deltas?

### G10 — AnularEventoFinanciero: impactos y autorización (Fase 3)
- **Qué falta**: DATABASE_DESIGN §4 dice que Anular "borra o marca" los
  `impacto_patrimonial`; el esquema no tiene flag en esa tabla. El DDD no dice
  quién puede anular/corregir.
- **Decisión provisional (Fase 3)**:
  - Se **conservan** las filas `impacto_patrimonial` (no hay flag para marcar);
    quedan "marcadas" transitivamente por `evento_financiero.anulado` y se
    filtran en `GET /elementos-patrimoniales/:id/impactos`. `valor_vigente` se
    revierte con aritmética directa. El evento anulado sigue apareciendo en
    `GET /eventos-financieros?elemento=` con `anulado: true`.
  - Puede anular/corregir cualquier **propietario de un elemento afectado**.
- **Colapso visual** original+corrección (UX_FLOWS Flujo 6): la app los muestra
  como filas separadas etiquetadas; el colapso en una sola línea llega después.

### G11 — Valorización: cadena lineal y `admite_valorizacion` (Fase 4)
- **Qué falta**: AS #18 dice que la cadena de valorizaciones "debe ser
  recorrible en orden" pero no acota cuál se puede anular.
- **Decisión provisional (Fase 4)**: solo se puede **anular o corregir la última
  valorización vigente** del elemento (igual que G9 para eventos).
  `AnularValorizacion` **elimina** el impacto asociado (DDD #18 dice "eliminar",
  y el esquema no tiene flag en `impacto_patrimonial`).
- **`admite_valorizacion`**: se fija al crear el elemento
  (`RegistrarElementoPatrimonial`). No hay comando para activarlo/desactivarlo
  después — si creaste un elemento sin ese flag, no puedes valorizarlo. La app
  lo activa por defecto para categorías ACTIVO / INVERSION.
- **Para decidir**: ¿anular/corregir valorizaciones intermedias re-encadenando?
  ¿un comando para cambiar `admite_valorizacion`?

### G12 — Fase 5b: comandos de ciclo de vida — detalles
- `CambiarMonedaConsolidacion` (#36) cambia el campo pero **no recalcula
  consolidaciones** en la nueva moneda (W) — no hay proyección de consolidación
  ni tipos de cambio (ver G7).
- `EliminarHogar` (#42) hace **delete físico** de hogar + membresías +
  invitaciones. El registro de "quién estuvo" queda solo en `auditoria`
  (`valor_anterior.miembros_desvinculados`).
- `RemoverMiembro` / `SalirDeHogar` marcan `membresia.estado = 'SALIDA'`
  (conservan la fila).
- `EliminarElementoPatrimonial` (#9) solo si el elemento no tiene ningún
  `impacto_patrimonial` ni reserva. `CorregirDatosElementoPatrimonial` (#3) es
  un `UPDATE` idéntico a #2 con `comando` distinto + motivo (la config no es
  hecho económico; su historial vive en auditoría — DATABASE_DESIGN §3).

### G13 — Propiedad de Objetivo Financiero y Asignación (migración 001)
- **Qué falta**: DDD Secciones H y J no definen quién es dueño de un objetivo o
  una asignación, y el esquema original no tenía columna de propiedad.
- **Decisión**: son **personales** — la migración `api/db/migrations/001_...sql`
  agrega `usuario_id` a `objetivo_financiero` y `asignacion`. Consistente con el
  planteamiento monousuario del Flujo 5 (UX_FLOWS). Reflejado también en
  `init/01_schema.sql`.
- **Para decidir**: ¿objetivos/asignaciones compartidos por hogar?

### G14 — Fase 5c: políticas y simplificaciones
- **"Completar objetivo"**: solo transiciona EN_PROGRESO → COMPLETADO. Si el
  progreso baja después (LiberarReserva), el objetivo **no** vuelve a
  EN_PROGRESO solo — el usuario lo hace con `CambiarEstadoObjetivoFinanciero`
  (Principio 4: última palabra del usuario). Genera fila de auditoría propia
  encadenada al comando que la disparó (DATABASE_DESIGN §11).
- **"Consumir reserva"**: al asociar un evento financiero a una asignación
  (`asignacionId` en RegistrarEventoFinanciero), **todas** sus reservas ACTIVAS
  pasan a CONSUMIDA (modelo grueso — no se consume "hasta el monto del evento").
  Se registra embebido en la entrada de RegistrarEventoFinanciero.
- **Disponibilidad / valor libre**: `valor_vigente − Σ reservas ACTIVAS`,
  calculado en vivo. La reserva no mueve `valor_vigente` (no es hecho económico).
- **AnularEventoFinanciero** de un evento que consumió reservas: no las
  "des-consume" (quedan CONSUMIDA). Pendiente.

### G8 — CONVERSION y PRESTAMO
- **CONVERSION**: **implementado en Fase 13**. `RegistrarEventoFinanciero` con
  `tipo: 'CONVERSION'`, origen y destino en monedas distintas; el destino recibe
  el equivalente vía `ConversionService`. No se corrige (se anula y se registra
  de nuevo — la tasa afecta ambos lados); sí se anula.
- **PRESTAMO**: **descartado como tipo propio** (decisión de esta sesión). Ya se
  modela con Deuda/Crédito: crear un elemento CREDITO/DEUDA y mover el saldo con
  TRANSFERENCIA (ver G17). Se mantiene el valor `PRESTAMO` en el CHECK del
  esquema por si más adelante se quiere distinguir por efectos legales.

### G15 — Propiedad de Presupuesto (migración 002) y "asignaciones esperadas"
- **Qué falta**: el esquema de `presupuesto` no tiene columna de propiedad, pero
  AS #49 audita "usuario/hogar" y `tipo` INDIVIDUAL/FAMILIAR implica dueños
  distintos. Además el input de AS #49 menciona "asignaciones esperadas" y el
  esquema no tiene esa columna (solo `ingresos_esperados`, `gastos_esperados`,
  `ahorro_esperado`).
- **Decisión (propiedad)**: migración `002_presupuesto_propietario.sql` agrega
  `usuario_id` (creador, siempre) y `hogar_id` (solo FAMILIAR), con CHECK
  `FAMILIAR ⇒ hogar_id NOT NULL` / `INDIVIDUAL ⇒ hogar_id NULL`. Misma línea que
  la 001. INDIVIDUAL → solo el dueño; FAMILIAR → cualquier miembro ACTIVA del hogar.
- **Decisión ("asignaciones esperadas")**: se **omite** — no hay columna y no se
  inventa una (BUILD_INSTRUCTIONS §4). El presupuesto cubre ingresos/gastos/ahorro.
- **Para decidir**: ¿agregar `asignaciones_esperadas` (monto agregado) o una tabla
  hija presupuesto_linea por asignación esperada?

### G16 — Proyección desviacion_presupuestaria: alcance y moneda (Fase 6)
- **Qué falta**: DATABASE_DESIGN §12 define la proyección como "comparación entre
  montos esperados y reales agregados desde `evento_financiero` en el período"
  sin precisar qué eventos entran ni cómo se maneja la moneda.
- **Decisión provisional (Fase 6)**:
  - **Período**: `[fecha_inicio, fecha_fin]` del presupuesto (para PERIODICO se
    derivan del intervalo; para ESPECIFICO son las declaradas — si faltan, sin
    filtro temporal).
  - **Alcance**: eventos con impacto sobre un elemento de un propietario dentro
    del alcance — el dueño (INDIVIDUAL) o los miembros ACTIVA del hogar (FAMILIAR).
  - **Agregación**: `real.ingresos = Σ monto` de eventos INGRESO;
    `real.gastos = Σ monto` de eventos GASTO; `real.ahorro = ingresos − gastos`.
    TRANSFERENCIA/CONVERSION/PRESTAMO no cuentan. Eventos anulados se excluyen.
  - **Moneda**: se suman los montos tal cual, sin tipo de cambio (ver G7). El
    presupuesto no tiene moneda propia.
- **Para decidir**: ¿presupuesto con moneda?, ¿ahorro real desde reservas/objetivos
  en vez de ingresos−gastos?, ¿excluir transferencias entre elementos del alcance
  ya está bien así?

### G17 — Deuda/Crédito: signo del valor_vigente y relación con valor_pendiente (Fase 8)
- **Qué falta**: ni el DDD ni DATABASE_DESIGN fijan el signo de
  `elemento_patrimonial.valor_vigente` para una DEUDA, ni cómo se relaciona con
  `valor_pendiente` cuando cambian por evento/ajuste.
- **Decisión provisional (Fase 8)**:
  - **DEUDA** → `valor_vigente` **negativo** (arrastra el patrimonio hacia abajo);
    **CREDITO** → `valor_vigente` positivo. En ambos, magnitud = `valor_pendiente`.
  - `RegistrarElementoPatrimonial` para DEUDA/CREDITO exige `valorPendiente > 0`,
    ignora `valorInicial` y deriva el `valor_vigente` con signo. No admite
    valorización.
  - **Invariante `valor_pendiente == |valor_vigente|`**: se mantiene con la
    política muda `derivarValorPendiente` (`src/common/deuda.ts`), llamada tras
    cada impacto en `RegistrarEventoFinanciero` / `AnularEventoFinanciero` /
    `CorregirEventoFinanciero` / los tres comandos de Ajuste. Sin entrada de
    auditoría propia (DDD Sección U: política 1-a-1 y muda).
  - Pagar una deuda / cobrar un crédito se modela como **TRANSFERENCIA** entre la
    cuenta y el elemento DEUDA/CREDITO (el impacto sobre este último mueve su
    `valor_vigente` hacia cero y el invariante actualiza `valor_pendiente`).
  - `CondonarDeuda` / `DeclararIncobrable` llevan `valor_vigente` y
    `valor_pendiente` a 0 y generan un impacto `origen_tipo` `CONDONACION` /
    `DECLARACION_INCOBRABLE` (migración 003) cuyo `origen_id` apunta a la entrada
    de auditoría del comando (no hay tabla propia).
- **Para decidir**: ¿un tipo de evento `PRESTAMO` propio (G8) en vez de
  TRANSFERENCIA hacia el elemento crédito? ¿intereses como Ajuste o como evento?

### G18 — Reconstrucción histórica: sin fecha de alta ni de baja (Fase 9)
- **Qué falta**: DDD Sección V pide reconstruir el estado a una fecha pasada
  aplicando los hechos con `fecha <= X`. El modelo no guarda "fecha de alta" ni
  "fecha de baja" del elemento (Registrar/Desactivar/Reactivar son config, y la
  Sección V dice que la auditoría no participa).
- **Decisión provisional (Fase 9)**:
  - La reconstrucción retrocede desde `valor_vigente` restando los impactos con
    `fecha > X` (columna `impacto_patrimonial.fecha`, migración 004).
  - Para fechas anteriores a toda actividad devuelve el **valor inicial** del
    elemento — no distingue "no existía todavía".
  - Usa el `estado` ACTIVO/INACTIVO **actual** (un elemento hoy inactivo no
    aparece en el patrimonio histórico aunque estuviera activo en X).
  - Un evento hoy anulado se considera inexistente en toda la línea de tiempo
    (la anulación no tiene fecha de hecho económico).
- **Para decidir**: ¿agregar `fecha_alta` / `fecha_baja` al elemento? ¿fecha a la
  anulación para reconstruirla en el tiempo?

### G19 — Consolidación del hogar sin `hogar_id` en el elemento (Fase 10)
- **Qué falta**: DDD Sección Q dice "un elemento participa en una única
  consolidación de hogar", pero el esquema solo tiene el booleano
  `participa_consolidacion` — no hay columna que apunte a qué hogar.
- **Decisión provisional (Fase 10)**: un elemento con `participa_consolidacion =
  true` entra en la consolidación de **todo hogar** donde alguno de sus
  propietarios sea miembro ACTIVA. En el caso normal (un hogar por usuario) es
  exacto; con multi-hogar un elemento podría contarse en dos consolidaciones.
- **Otras decisiones de Fase 10**:
  - El elemento se suma **una vez por su `valor_vigente` completo** (no ponderado
    por %) — Sección Q: "no debe duplicar elementos compartidos".
  - **Sin total entre monedas** (G7): desglose `porMoneda`.
  - Pasivos = categoría `DEUDA` (magnitud); `CREDITO` es activo.
  - "Avance de objetivos del hogar" agrega los objetivos personales de todos los
    miembros ACTIVA (los objetivos siguen siendo personales, G13).
  - `GET /hogares/:id/eventos-financieros` (no `?hogar=` como en API_DESIGN):
    una fila por evento (colapsa transferencias) con `montoEfectivo` neto de
    correcciones vivas (colapsa el par original+compensatorio).
- **Para decidir**: ¿`elemento.hogar_consolidacion_id` explícito?

### G20 — Notificaciones (Fase 11 + 14c)
- **In-app (Fase 11)**: tabla `notificacion` (migración 005), registro que NO es
  dominio (sin auditoría, regenerable). Se emite dentro de la transacción del
  comando. Generadores: **OBJETIVO_COMPLETADO**, **RESERVA_CONSUMIDA**,
  **INVITACION_RECIBIDA**. Endpoints `GET /usuarios/me/notificaciones(/no-leidas)`,
  `POST .../:id/leer`, `POST .../leer-todas`.
- **Push (Fase 14c)**: tabla `dispositivo_push` (migración 008) con los Expo push
  tokens del usuario (`POST` / `DELETE /usuarios/me/dispositivos-push`). Al emitir
  una notificación se dispara un push best-effort (fuera de la transacción —
  podría llegar huérfano si el comando revierte) vía `PushSender` →
  `ExpoPushSender` (POST a la Expo Push API, sin credenciales). La app registra
  el token al iniciar sesión (`src/push/registerPush.ts`).
- **Pendiente**: el push remoto necesita un **development build + `projectId` de
  EAS** — en Expo Go SDK 53+ está limitado, y en web/simulador `registerPush`
  devuelve null (no rompe nada). Preferencias de notificación y reintentos de
  envío fallido tampoco están.

### G5 — Consulta "mis invitaciones recibidas"
- **Qué falta**: la pantalla del invitado (UX_FLOWS Flujo 2, paso 4) necesita
  listar sus invitaciones pendientes, pero no conoce el `hogar_id`. API_DESIGN
  solo tiene `GET /hogares/{id}/invitaciones?estado=PENDIENTE` (por hogar).
- **Decisión**: se agregó `GET /usuarios/me/invitaciones?estado=PENDIENTE`,
  simétrico a `GET /usuarios/me/hogares` que sí existe.
- **Por qué es aceptable**: API_DESIGN § "Resumen de cobertura" dice que las
  consultas "no se cuentan 1:1 contra ningún catálogo... se diseñaron según
  necesidad de UI/dashboard razonable". No es un comando ni una regla nueva.

---

## Detectados en la revisión de UI/UX (Fase 15)

Ver `Docs/UI_UX_BACKLOG.md` para el backlog completo de UI/UX. Estos son los
vacíos que requieren **decisión de dominio + migración** antes de ser UI.

### G22 — Glosa / detalle en el movimiento financiero
- **Qué falta**: `evento_financiero` solo tiene `tipo, monto, moneda, fecha`. No
  hay dónde escribir "pago internet marzo". Ni los 6 docs lo contemplan
  (AS #5 menciona "comentarios" como tipo de información de visibilidad, pero no
  se modeló). Sin esto, el historial de movimientos es ilegible.
- **Opciones**:
  - (a) `evento_financiero.glosa TEXT NULL` — texto libre corto (≤140), opcional.
    Inmutable como el resto del evento (se corrige anulando + registrando, o se
    permite editar solo la glosa por ser texto no económico).
  - (b) tabla `comentario` polimórfica (evento / elemento / …) — más potente,
    alinea con AS #5, pero es un agregado nuevo.
- **Recomendación**: (a) para empezar. Migración 009. `RegistrarEventoFinanciero`
  y `CorregirEventoFinanciero` aceptan `glosa?`. Es configuración/anotación, no
  hecho económico → no participa de la reconstrucción histórica (Sección V).
- **Para decidir**: ¿la glosa se puede editar sin anular el evento?

### G23 — Categorización de movimientos: categoría vs. etiqueta
- **Qué falta**: no hay forma de clasificar un gasto/ingreso ("Mercado",
  "Servicios", "Sueldo"). El presupuesto (Agregado K) solo compara totales de
  ingreso/gasto, no por rubro. No hay registro rápido de gastos recurrentes.
- **Distinción** (pedida explícitamente por el usuario):
  | | Categoría | Etiqueta |
  |---|---|---|
  | Cardinalidad | 0..1 por movimiento | 0..N por movimiento |
  | Naturaleza | taxonomía excluyente | transversal, acumulativa |
  | Jerarquía | sí (padre/hijo, 2 niveles) | plana |
  | Presupuesto | base natural del rubro | ambiguo con solapamiento |
  | Alcance | vocabulario del hogar | personal |
  | Ejemplos | Mercado, Transporte, Salud, Vivienda, Sueldo | #reembolsable, #viaje-2026 |
- **Recomendación**: **ambas con roles distintos; la categoría es la columna
  vertebral**.
  - **Categoría** — tabla `categoria_movimiento(id, hogar_id, nombre,
    tipo_aplicable ENUM(INGRESO,GASTO,AMBOS), categoria_padre_id?, color?, icono?,
    orden, estado ENUM(ACTIVA,ARCHIVADA))`. `evento_financiero.categoria_id` NULL
    FK. Al crear el hogar se siembra un set inicial editable (~10 rubros). No se
    borra si tiene eventos → se archiva. Comandos `CrearCategoriaMovimiento`,
    `ActualizarCategoriaMovimiento`, `ArchivarCategoriaMovimiento`,
    `ReordenarCategoriasMovimiento`.
  - **Etiqueta** (Fase 15i) — tablas `etiqueta` (personal, `UNIQUE(usuario_id,
    nombre)`, color opcional) + `evento_etiqueta` (N:M, `ON DELETE CASCADE`).
    Migración 012. Anotación → historial solo en auditoría; se puede re-etiquetar
    un movimiento viejo sin anular (no participa de la Sección V). Comandos
    `CrearEtiqueta`, `ActualizarEtiqueta`, `EliminarEtiqueta` (cascada),
    `EtiquetarEvento` (reemplaza el conjunto de un movimiento propio no anulado).
    `RegistrarEventoFinanciero` acepta `etiquetaIds?`; `CorregirEventoFinanciero`
    hereda las del original. `GET /usuarios/me/etiquetas`. El DTO de evento gana
    `etiquetaIds: string[]`. **No** entra en el presupuesto (un gasto con 3
    etiquetas ¿a qué rubro imputa?).
  - **Agrupación de elementos patrimoniales** (REQUISITES §D: "Inversiones"
    agrupando Fintual/APV/Fondo) — concepto aparte: carpetas de visualización
    para tus cuentas/activos. Tabla `agrupacion_elemento` + pertenencia, personal,
    fase posterior. **No** se confunde con Asignación (Agregado H, que reserva
    valor con un propósito: "Vacaciones", "Matrícula").
- **Presupuesto por categoría** — nueva tabla `presupuesto_linea(presupuesto_id,
  categoria_id, monto_esperado)`; `desviacion_presupuestaria` se calcula también
  por rubro. Extiende G15 (que dejó "asignaciones esperadas" fuera).
- **Todo esto es configuración**, no hecho económico → historial solo en
  auditoría (DATABASE_DESIGN §125, Principio C).
- **Decisiones (sesión 2026-09-03)**:
  - Categorías **del hogar** (`categoria_movimiento.hogar_id`, vocabulario
    compartido). Administra cualquier miembro ACTIVA.
  - **Lista plana** al inicio (sin `categoria_padre_id`; se puede agregar después
    sin romper datos).
  - Categoría **siempre opcional** en el evento; los sin-categoría se agrupan como
    "Sin clasificar" en reportes.
  - **Ambas** (categoría + etiqueta), pero etiquetas y agrupaciones de elementos
    quedan para fase posterior — la categoría es la única de Fase 15c.

### G24 — Plantillas / movimientos recurrentes rápidos (Fase 15h)
- **Qué falta**: registrar "el gasto de siempre" (internet, arriendo) en 2 toques.
  Distinto de **Movimiento Programado** (#13–#16, que es un movimiento futuro
  concreto con fecha): una plantilla es un molde reutilizable sin fecha.
- **Decisión (sesión 2026-09-03)**:
  - Tabla `plantilla_movimiento(id, usuario_id, nombre, tipo INGRESO/GASTO/
    TRANSFERENCIA, monto?, moneda?, elemento_origen_id?, elemento_destino_id?,
    categoria_id?, glosa?, orden)`. Migración 011. **Personal** (`usuario_id`),
    `UNIQUE (usuario_id, nombre)`. Todos los campos salvo `nombre`/`tipo` son
    opcionales — es un molde, los huecos se llenan al usarla.
  - Es configuración → historial solo en `auditoria`; los eventos generados a
    partir de ella son independientes.
  - Comandos `CrearPlantillaMovimiento`, `ActualizarPlantillaMovimiento` (`null`
    limpia un campo), `EliminarPlantillaMovimiento` (borrado físico).
    `GET /usuarios/me/plantillas-movimiento`.
  - Validación: propiedad de los elementos; la categoría debe ser de un hogar del
    actor y compatible con el tipo; TRANSFERENCIA no lleva categoría.
  - **Usar una plantilla NO es un comando**: el cliente rellena
    `RegistrarEventoFinanciero` con sus valores. En la app: selector "Desde una
    plantilla" arriba de "Registrar movimiento" + botón "Guardar como plantilla"
    en el detalle de un movimiento (deriva origen/destino de los impactos).
  - CONVERSION queda fuera (dos monedas, más lógica).

### G25 — Sección de Ajustes / preferencias de visualización
- **Qué falta**: un lugar para administrar de forma granular lo que se muestra —
  categorías, etiquetas, agrupaciones, formato de fecha, secciones visibles del
  dashboard, tema, densidad, moneda de despliegue preferida, tipos de elemento
  sugeridos.
- **Estado actual**: `usuario.preferencias JSONB` **ya existe** en el esquema
  (DATABASE_DESIGN §87) y `ActualizarDatosUsuario` (#44) ya la acepta (reemplazo
  del objeto completo). DDD Sección B lista "Preferencias globales" como
  responsabilidad del Usuario. **Falta el lado de lectura**: `toUsuarioDTO` /
  `GET /usuarios/me` **no devuelven `preferencias`** hoy.
- **Recomendación**:
  - Exponer `preferencias` en `GET /usuarios/me` y darle forma (esquema de
    preferencias conocido, con defaults en el cliente).
  - Preferencias **personales** → `usuario.preferencias`. Config **del hogar**
    (categorías, moneda de consolidación, tipos de elemento sugeridos) → tabla
    propia o `hogar` (hoy `hogar` solo tiene `nombre` + `moneda_consolidacion`).
  - Pantalla **Ajustes** con sub-secciones: Perfil · Categorías · Etiquetas ·
    Agrupaciones · Preferencias de visualización · Notificaciones · Hogar.
- **Para decidir**: ¿qué preferencias son del usuario y cuáles del hogar?
  ¿`hogar.configuracion JSONB` o tablas normalizadas?

### G26 — Presupuesto por rubro (línea de presupuesto) (Fase 15d)
- **Qué falta**: el Presupuesto (Agregado K) solo compara totales de
  ingreso/gasto/ahorro (`ingresos_esperados`, `gastos_esperados`,
  `ahorro_esperado`). No hay forma de fijar cuánto se espera por categoría
  (Mercado, Servicios…), que era el punto abierto de G15 ("asignaciones
  esperadas") y lo pedido en `UI_UX_BACKLOG.md` C3. Ningún doc lo modela.
- **Decisión (sesión 2026-09-03)**:
  - Tabla `presupuesto_linea(id, presupuesto_id, categoria_id, monto_esperado ≥ 0)`
    con `UNIQUE (presupuesto_id, categoria_id)` y `ON DELETE CASCADE` desde
    `presupuesto`. Migración 010. Es **configuración**, no hecho económico → su
    historial vive solo en `auditoria` (DATABASE_DESIGN §125, Principio C); no
    participa de la reconstrucción histórica (Sección V).
  - Comando **`DefinirLineasPresupuesto`** (`{ presupuestoId, lineas: [{ categoriaId,
    montoEsperado }] }`): **reemplaza el conjunto completo** de líneas — una sola
    entrada de auditoría con `valor_anterior` / `valor_posterior`. Un rubro con
    monto 0 se elimina. Se rechaza si el presupuesto está `CERRADO`.
  - **Categorías permitidas**: FAMILIAR → las del hogar del presupuesto;
    INDIVIDUAL (sin `hogar_id`) → las de cualquier hogar donde el actor sea
    miembro ACTIVA (en el caso normal de un hogar por usuario, es inequívoco).
    Solo categorías `ACTIVA`.
  - La proyección `desviacion_presupuestaria` gana `porRubro[]` (esperado vs. real
    de cada categoría dentro del período, más los rubros con movimiento real pero
    sin línea, con esperado 0) y `sinClasificar` (ingreso/gasto real del período
    sin `categoria_id`). El "real" de un rubro usa los eventos INGRESO/GASTO del
    mismo alcance y período que el total (G16), sin tipo de cambio.
  - `GET /presupuestos/:id/lineas` para el editor (líneas + nombre/color de la
    categoría).
- **Para decidir**: ¿la suma de las líneas de gasto debería cuadrar con
  `gastos_esperados` (hoy son independientes)? ¿líneas de ahorro por objetivo
  (cierra del todo G15)?
