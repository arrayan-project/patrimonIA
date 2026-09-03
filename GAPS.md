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
- **Opciones**: (a) cálculo trivial de UI — `% pagado = (monto_original - valor_pendiente) / monto_original`;
  (b) estado formal nombrado en el modelo.
- **Estado**: sin decidir. No implementar (a) como estado formal sin decisión
  explícita. Fase 1 no toca Deuda/Crédito.

### G2 — Visibilidad / propiedad de Movimiento Programado
- **Qué falta**: definir si `movimiento_programado` lleva columnas de
  visibilidad/propiedad propias o hereda las del elemento destino.
- **Por qué no está resuelto**: DDD Sección S lo deja explícitamente para después.
- **Estado**: sin decidir. No agregar columnas ni lógica sin decisión explícita.
  Fase 1 no toca Movimiento Programado.

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
  "token de sesión temporal de registro, no de usuario ya autenticado". Ese
  pre-registro (pedir el token) no está modelado — no hay comando que lo emita.
- **Decisión provisional (técnica, no de dominio)**: el endpoint queda `@Public()`
  (sin JWT). Gatearlo tras un token que nadie puede obtener todavía bloquearía el
  alta por completo.
- **Para decidir**: diseñar el flujo de pre-registro (endpoint anónimo que emite
  un token de registro de corta duración, p. ej. tras un captcha o un email) —
  es infraestructura de auth, se puede resolver sin tocar el DDD.

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

### G7 — Proyección patrimonio_individual: en vivo vs. materializada, y sin total
- **Qué falta**: DATABASE_DESIGN §12 y el comentario de `schema.sql` dejan
  pendiente si las proyecciones son vista SQL en vivo o tabla materializada
  (decisión de performance). Además, sin tipos de cambio (Sección S REQUISITES)
  no hay un total consolidado entre monedas.
- **Decisión provisional**: `GET /usuarios/me/patrimonio-individual` se calcula
  **en vivo** desde la info primaria (Principio 1) y devuelve un desglose
  `porMoneda`, sin total único.
- **Para decidir**: materializar si el cálculo en vivo escala mal; subsistema de
  tipos de cambio para consolidar.

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

### G8 — CONVERSION y PRESTAMO (tipos de Evento Financiero no cubiertos en Fase 2)
- **Qué falta**: `evento_financiero.tipo` admite CONVERSION y PRESTAMO. Fase 2
  solo implementa INGRESO/GASTO/TRANSFERENCIA.
- **Por qué**: CONVERSION necesita tipo de cambio (ver G7); PRESTAMO se cruza con
  Deuda/Crédito (Flujo 4, y el vacío G1). Ambos son ciclos verticales aparte.

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

### G5 — Consulta "mis invitaciones recibidas"
- **Qué falta**: la pantalla del invitado (UX_FLOWS Flujo 2, paso 4) necesita
  listar sus invitaciones pendientes, pero no conoce el `hogar_id`. API_DESIGN
  solo tiene `GET /hogares/{id}/invitaciones?estado=PENDIENTE` (por hogar).
- **Decisión**: se agregó `GET /usuarios/me/invitaciones?estado=PENDIENTE`,
  simétrico a `GET /usuarios/me/hogares` que sí existe.
- **Por qué es aceptable**: API_DESIGN § "Resumen de cobertura" dice que las
  consultas "no se cuentan 1:1 contra ningún catálogo... se diseñaron según
  necesidad de UI/dashboard razonable". No es un comando ni una regla nueva.
