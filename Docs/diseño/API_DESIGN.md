# Diseño de API — PatrimonIA

**Objetivo:** el contrato REST — un endpoint por cada Application Service
(`POST /comandos/{Nombre}` para mutaciones, REST clásico para consultas).
Si un endpoint del código no está acá, o viceversa, el contrato está roto.

> **Migrado de `.docx` a Markdown el 2026-09-06** (el original está en `Docs/_baseline/`). Este `.md` es ahora la fuente de verdad; las decisiones posteriores a Fase 0 se integran aquí y se registran en `GAPS.md`.

*Contrato de API que expone los 52 casos de uso de Application Services (APPLICATION_SERVICES.md) y las proyecciones de lectura del modelo de datos (DATABASE_DESIGN.md, sección 12). Estilo híbrido: comandos explícitos para mutaciones, REST clásico para consultas — ver justificación de la decisión al inicio de este bloque de trabajo.*

## Convenciones

- Mutaciones: `POST /comandos/{NombreComando}`. Un endpoint por comando, mapeo 1:1 con Application Services. Body = DTO de input. Response 200 = output DTO. Response 4xx = error de validación (ver tabla de invariantes de cada agregado en DDD/DB design).
- Consultas: REST clásico bajo rutas de recurso. `GET`, cacheable, sin efectos secundarios.
- Autenticación: header `Authorization: Bearer {jwt}` en todo endpoint, sin excepción — incluye `RegistrarUsuario`, que usa un token de sesión temporal de registro, no de usuario ya autenticado.
- Autorización: se valida dentro del Application Service (ej. “solo administrador puede ejecutar X”), no en el API gateway. El endpoint no necesita lógica de autorización propia más allá de “usuario autenticado” — el rechazo por rol específico llega como 403 desde el Application Service.
- Auditoría: todo comando exitoso genera automáticamente su entrada de auditoría (Sección U) — no es un paso separado que el cliente deba invocar.
- Idempotencia: los comandos de creación (`Registrar*`, `Crear*`) aceptan un header opcional `Idempotency-Key` para evitar duplicados por reintento de red — no está en el DDD, es una decisión estándar de API que no contradice el dominio.

# A. Elemento Patrimonial

## Comandos

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/RegistrarElementoPatrimonial` | #1 | nombre, tipo, categoría funcional, valor inicial, moneda, propietarios[], config. valor líquido, config. consolidación, visibilidad |
| `POST /comandos/ActualizarDatosElementoPatrimonial` | #2 | id, campos no patrimoniales |
| `POST /comandos/CorregirDatosElementoPatrimonial` | #3 | id, campo(s), motivo |
| `POST /comandos/CambiarPropiedadElementoPatrimonial` | #4 | id, propietarios entrantes[], propietarios salientes[] |
| `POST /comandos/CambiarVisibilidadElementoPatrimonial` | #5 | id, configuración de visibilidad por tipo de información |
| `POST /comandos/CambiarParticipacionEnConsolidacion` | #6 | id, participa (bool) |
| `POST /comandos/DesactivarElementoPatrimonial` | #7 | id, motivo (opcional) |
| `POST /comandos/ReactivarElementoPatrimonial` | #8 | id, motivo |
| `POST /comandos/EliminarElementoPatrimonial` | #9 | id, justificación |

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /elementos-patrimoniales/{id}` | ElementoPatrimonialDTO — respeta visibilidad configurada, filtra campos según quién consulta. Incluye `fechaUltimaValorizacion` (la última valorización vigente, para el aviso anual de valor; G39, F-19) |
| `GET /elementos-patrimoniales?propietario={usuario_id}` | Lista de elementos donde el usuario es propietario (activos, incluye % de participación) |
| `GET /elementos-patrimoniales/{id}/valorizaciones` | Historial de valorizaciones del elemento (Sección G, DDD) |
| `GET /elementos-patrimoniales/{id}/impactos` | Historial de impactos patrimoniales que le afectan directamente (REQUISITES, Sección K) |

Nota de diseño: `GET /elementos-patrimoniales/{id}` no expone directamente el modelo de tabla — aplica el filtro de visibilidad (Sección M, REQUISITES) según la relación del solicitante con el elemento (propietario, miembro con visibilidad compartida/familiar, o sin acceso). Esto es lógica de consulta, no un comando, pero sigue siendo lógica de dominio — vive en un servicio de lectura separado del Application Service de comandos, no en el controller HTTP directamente.

# D. Evento Financiero

## Comandos

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/RegistrarEventoFinanciero` | #10 | tipo, monto, moneda, elemento(s) origen/destino, fecha, asignación (opcional), movimiento programado origen (opcional), `montoDestino` (opcional, solo CONVERSION: lo que llegó a la cuenta destino; manda sobre la tasa vigente — G39, M11) |
| `POST /comandos/AnularEventoFinanciero` | #11 | id, motivo |
| `POST /comandos/CorregirEventoFinanciero` | #12 | id original, datos corregidos, motivo |

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /eventos-financieros/{id}` | EventoFinancieroDTO con sus impactos. Si tiene correcciones vivas, `vigente` (monto, fecha, detalle y la cadena de correcciones); si una de las cuentas es de otro miembro, `contraparte` (quién y cuál cuenta) — G39 |
| `GET /eventos-financieros?elemento={elemento_id}` | Historial de movimientos relevantes para el elemento (REQUISITES Sección K: “el historial de un elemento patrimonial muestra los impactos patrimoniales asociados”) |
| `GET /eventos-financieros?hogar={hogar_id}` | Vista consolidada — una transferencia se muestra como un único movimiento (REQUISITES Sección K), no como sus 2+ impactos separados |

# Movimiento Programado (agregado propio)

## Comandos

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/CrearMovimientoProgramado` | #13 | monto planificado, fecha programada, elemento destino, observaciones, `periodicidad?` (MENSUAL/ANUAL), `categoriaId?` (D-6) |
| `POST /comandos/ActualizarMovimientoProgramado` | #14 | id, campos a modificar (incluye `categoriaId`) |
| `POST /comandos/MaterializarMovimientoProgramado` | #15 | id, monto efectivo, fecha efectiva |
| `POST /comandos/CancelarMovimientoProgramado` | #16 | id, motivo, `serie?` ("Dejar de repetir", D-6) |

El DTO incluye `periodicidad`, `dia`, `serieId` y `categoriaId` (D-6). El aviso
de una ocurrencia vencida es una notificación `PROGRAMADO_VENCIDO` con
`entidadTipo = MOVIMIENTO_PROGRAMADO`.

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /movimientos-programados?estado=PENDIENTE` | Movimientos pendientes del usuario/hogar — vista de “por confirmar” (REQUISITES Sección O) |
| `GET /movimientos-programados/{id}` | MovimientoProgramadoDTO, incluyendo referencia al evento financiero si ya fue materializado |

# G. Valorización

## Comandos

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/RegistrarValorizacion` | #17 | id del elemento, valor nuevo, fecha |
| `POST /comandos/AnularValorizacion` | #18 | id, motivo |
| `POST /comandos/CorregirValorizacion` | #19 | id original, valor correcto, motivo |

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /elementos-patrimoniales/{id}/valorizaciones` | (mismo endpoint que en sección A — vive en el recurso elemento, no duplicado) |

# L. Ajuste Patrimonial

## Comandos

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/RegistrarAjustePatrimonial` | #20 | id del elemento, monto, motivo (obligatorio), fecha |
| `POST /comandos/AnularAjustePatrimonial` | #21 | id, motivo |
| `POST /comandos/CorregirAjustePatrimonial` | #22 | id original, datos corregidos, motivo |

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /ajustes-patrimoniales?elemento={elemento_id}` | Historial de ajustes sobre un elemento — para distinguir en UI ajustes vs. eventos financieros (REQUISITES Sección P) |

# H. Asignación + I. Reserva

## Comandos — Asignación

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/CrearAsignacion` | #23 | nombre, monto objetivo, objetivo financiero asociado (opcional) |
| `POST /comandos/ActualizarDatosAsignacion` | #24 | id, campos a modificar |
| `POST /comandos/CambiarAsociacionAObjetivo` | #25 | id, objetivo nuevo (o null) |
| `POST /comandos/EliminarAsignacion` | #26 | id, motivo |

## Comandos — Reserva

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/CrearReserva` | #27 | asignación destino, elemento(s) origen, monto |
| `POST /comandos/AjustarMontoReserva` | #28 | id, nuevo monto |
| `POST /comandos/LiberarReserva` | #29 | id, motivo |

*Nota: no existe *`*POST /comandos/ConsumirReserva*`* — es una política automática (Sección T/U), no un comando invocable. Se dispara internamente dentro de *`*RegistrarEventoFinanciero*`*.*

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /asignaciones/{id}` | AsignacionDTO con sus reservas y estado de financiamiento |
| `GET /asignaciones/{id}/reservas` | Lista de reservas activas de la asignación, con elemento origen de cada una |
| `GET /asignaciones?objetivo={objetivo_id}` | Asignaciones asociadas a un objetivo financiero |

# J. Objetivo Financiero

## Comandos

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/CrearObjetivoFinanciero` | #30 | nombre, monto objetivo, fecha objetivo (opcional) |
| `POST /comandos/ActualizarDatosObjetivoFinanciero` | #31 | id, campos a modificar |
| `POST /comandos/CambiarEstadoObjetivoFinanciero` | #32 | id, nuevo estado |
| `POST /comandos/EliminarObjetivoFinanciero` | #33 | id, motivo |

*Nota: no existe *`*POST /comandos/CompletarObjetivo*`* — es política automática, se dispara al recalcular progreso (Sección T/U).*

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /objetivos-financieros/{id}` | ObjetivoFinancieroDTO con progreso calculado (proyección `progreso_objetivo`, DB design sección 12) |
| `GET /objetivos-financieros?estado=EN_PROGRESO` | Objetivos activos del usuario/hogar |

# A. Hogar

## Comandos

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/CrearHogar` | #34 | nombre |
| `POST /comandos/ActualizarDatosHogar` | #35 | id, campos a modificar |
| `POST /comandos/CambiarMonedaConsolidacion` | #36 | id, nueva moneda |
| `POST /comandos/InvitarMiembro` | #37 | id del hogar, usuario invitado |
| `POST /comandos/AceptarInvitacion` | #38 | id de la invitación |
| `POST /comandos/RechazarInvitacion` | #39 | id de la invitación |
| `POST /comandos/AsignarRol` | #40 | id del hogar, miembro objetivo, rol nuevo |
| `POST /comandos/RemoverMiembro` | #41 | id del hogar, miembro, motivo |
| `POST /comandos/EliminarHogar` | #42 | id, motivo |

*Nota: no existe *`*POST /comandos/UnirseAHogar*`* — política interna disparada exclusivamente por *`*AceptarInvitacion*`* (Sección T).*

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /hogares/{id}` | HogarDTO — nombre, moneda de consolidación, miembros |
| `GET /hogares/{id}/miembros` | Lista de membresías activas con rol |
| `GET /hogares/{id}/invitaciones?estado=PENDIENTE` | Invitaciones pendientes del hogar |
| `GET /hogares/{id}/patrimonio-consolidado` | Proyección `patrimonio_familiar_consolidado` (DB design sección 12) |
| `GET /hogares/{id}/metricas` | Métricas patrimoniales del hogar (Sección N, DDD: liquidez, distribución, variación, avance de objetivos) |

# B. Usuario

## Comandos

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/RegistrarUsuario` | #43 | identidad, credenciales |
| `POST /comandos/ActualizarDatosUsuario` | #44 | id, campos a modificar |
| `POST /comandos/SalirDeHogar` | #45 | id usuario, id hogar |
| `POST /comandos/DesactivarUsuario` | #46 | id, motivo |

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /usuarios/me` | UsuarioDTO del usuario autenticado |
| `GET /usuarios/me/hogares` | Hogares a los que pertenece (un usuario puede estar en múltiples) |
| `GET /usuarios/me/patrimonio-individual` | Proyección `patrimonio_individual` (DB design sección 12) |

# Deuda / Crédito (especialización de Elemento Patrimonial)

## Comandos

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/CondonarDeuda` | #47 | id de la deuda, motivo |
| `POST /comandos/DeclararIncobrable` | #48 | id del crédito, motivo |

*Todos los demás comandos de Elemento Patrimonial (Registrar, CambiarPropiedad, Desactivar, etc.) se reutilizan sin endpoint propio — Deuda/Crédito no es un agregado distinto (Sección T).*

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /elementos-patrimoniales?categoria=DEUDA` | Deudas del usuario/hogar, con valor pendiente y estado operativo derivado |
| `GET /elementos-patrimoniales?categoria=CREDITO` | Créditos del usuario/hogar |

# K. Presupuesto

## Comandos

| Endpoint | Application Service | Body (resumen) |
| --- | --- | --- |
| `POST /comandos/CrearPresupuesto` | #49 | tipo, período/propósito, montos esperados |
| `POST /comandos/ActualizarDatosPresupuesto` | #50 | id, campos a modificar |
| `POST /comandos/CambiarAlcancePresupuesto` | #85 | presupuestoId, tipo (INDIVIDUAL/FAMILIAR), hogarId (solo FAMILIAR) — GAPS G36 |
| `POST /comandos/CerrarPresupuesto` | #51 | id (específico, no periódico), motivo |
| `POST /comandos/EliminarPresupuesto` | #52 | id, motivo |

## Consultas

| Endpoint | Devuelve |
| --- | --- |
| `GET /presupuestos/{id}` | PresupuestoDTO |
| `GET /presupuestos/{id}/desviacion` | Proyección `desviacion_presupuestaria` (DB design sección 12) — comparación presupuestado vs. real |
| `GET /presupuestos?tipo=FAMILIAR&vigente=true` | Presupuestos vigentes — para periódicos, calculado por calendario; para específicos, por `estado = ACTIVO` |

# Endpoints añadidos (Fases 13–52 y G33)

Verificado contra los decoradores de ruta del backend.

## Comandos (`POST /comandos/{Nombre}`)

Los 32 comandos nuevos de `APPLICATION_SERVICES.md` §"Casos de uso añadidos"
(#53–#84) tienen cada uno su `POST /comandos/{Nombre}`, con el mismo mapeo 1:1.
Todos los `Registrar*` / `Crear*` aceptan el header opcional **`Idempotency-Key`**
(la app lo manda en todos los comandos de G33).

Los de G33 (orquestaciones sobre comandos existentes; errores con `codigo`):

| Endpoint | AS # | Input clave |
|---|---|---|
| `POST /comandos/AhorrarParaObjetivo` | #79 | objetivoId, asignacionId?, destinoId?, origenes[] (elementoId, monto), fecha? |
| `POST /comandos/RegistrarPlataDeOtraPersona` | #80 | direccion (ENTRA/SALE), cuentaId, monto, persona, fecha?, glosa?, anularIngresoId?, registrarEntrada? |
| `POST /comandos/RegistrarGastoCompartido` | #81 | campos de un GASTO + partes[] (usuarioId, monto) + cuentaDestinoId |
| `POST /comandos/AvisarTransferenciaSinAnotar` | #82 | usuarioId, monto, cuentaDestinoId, fecha? |
| `POST /comandos/PagarSolicitud` | #83 | solicitudId, elementoOrigenId, fecha? — responde 200 |
| `POST /comandos/RechazarSolicitud` | #84 | solicitudId — responde 200 |

## Consultas nuevas

| Endpoint | Devuelve | Fase / gap |
|---|---|---|
| `GET /usuarios/me/resumen-financiero?desde=&hasta=&alcance=mios\|hogar&hogarId=` | totales por moneda, desglose por rubro, lista de movimientos (incluye TRANSFERENCIA/CONVERSION con `efectoPropio`, y SALDO_INICIAL); cada movimiento trae su cuenta de salida y de llegada (G39, S3-6) y, si fue con otro miembro del hogar, `contraparte` | Fase 16 / G27 |
| `GET /usuarios/me/resumen-anual?anio=&alcance=&hogarId=` | 12 baldes `{mes, porMoneda}` | Fase 16 / G27 |
| `GET /usuarios/me/serie-patrimonial?desde=&hasta=&pasos=` | N puntos equiespaciados del patrimonio individual; lo anotado después de un punto cuenta en él con su valor al anotarse (GAPS G38) | Fase 15g |
| `GET /usuarios/me/variacion-patrimonial?desde=&hasta=` | patrimonio en 2 fechas + variación (abs / %), con la misma regla de G38 (anotar no es ganar ni perder) | Fase 9 |
| `GET /usuarios/me/patrimonio-individual/historico?fecha=` | patrimonio reconstruido a esa fecha | Fase 9 / G18 |
| `GET /elementos-patrimoniales/:id/valor-historico?fecha=` | valor del elemento a esa fecha (`existia: bool`) | Fase 9 |
| `GET /hogares/:id/patrimonio-consolidado` | neto/activos/pasivos/líquido por moneda + `total` en moneda del hogar (o `conversionesFaltantes`) | Fase 10/13 |
| `GET /hogares/:id/metricas` | distribución por categoría, liquidez, avance de objetivos del hogar | Fase 10 |
| `GET /hogares/:id/elementos` | las cuentas y bienes que suman al total del hogar (mismo conjunto que `patrimonio-consolidado`); lo que el actor no ve con su valor, sumado en `ocultos` por grupo y moneda | GAPS G37 |
| `GET /hogares/:id/eventos-financieros` | vista consolidada: 1 fila por evento (transferencia colapsada), filtrada por §M | Fase 10 / G30 |
| `GET /hogares/:id/categorias-movimiento` · `/tipos-elemento` | catálogos del hogar | Fase 15c / 40 |
| `GET /usuarios/me/etiquetas` · `/agrupaciones` · `/plantillas-movimiento` | catálogos personales | Fase 15h–j |
| `GET /presupuestos/:id/lineas` · `/lineas-ahorro` · `/desviacion` | líneas por rubro / por objetivo · desviación con desglose | Fase 15d / 41 |
| `GET /usuarios/me/notificaciones` · `/no-leidas` · `POST …/:id/leer` · `…/leer-todas` | bandeja in-app | Fase 11 |
| `GET /tipos-cambio` · `POST /comandos/RegistrarTipoCambio` | tasas registradas | Fase 13 |
| `GET /tipos-cambio/tasa?origen=&destino=&fecha=` | la tasa que usaría una CONVERSION (directa, inversa o triangulada por CLP), o `null` | G39, M11 |
| `POST /usuarios/me/dispositivos-push` · `DELETE …` | Expo push tokens | Fase 14c |
| `POST /auth/registro-token` | token de pre-registro (rate-limit por IP; email opcional → envía código de 6 dígitos) | Fase 12/14c / G4 |
| `POST /auth/verificar-codigo-registro` | canjea `{ email, codigo }` por el token de pre-registro | G4 |
| `POST /auth/solicitar-reset-password` · `POST /auth/reset-password` | reset de contraseña con código de 6 dígitos `{ email, codigo, nuevaPassword }` | G31 |
| `GET /usuarios/me/disponibilidad` | libre para ahorrar por cuenta propia | G33 D-1 |
| `GET /usuarios/me/personas?todas=` | saldo con signo por persona y moneda (+ te debe, − le debes) | G33 D-3 |
| `GET /usuarios/me/solicitudes` | solicitudes entre miembros en las dos direcciones, con estado derivado y `cuentaDisponible` | G33 bloque 9 |
| `GET /usuarios/me/transferencias-hogar?dias=30` | TRANSFERENCIA vigentes entre cuentas propias y de otros miembros, con el nombre del miembro (`dias` de 1 a 366) | G33 bloque 9 / HZ-21 |

## Query params añadidos al listado de elementos

`GET /elementos-patrimoniales?propietario=me|<id>&incluirInactivos=&categoria=&alcance=hogar`
— `alcance=hogar` devuelve solo los elementos de co-miembros cuya `EXISTENCIA` el actor puede ver (§M).

# Resumen de cobertura

52 endpoints de comando de Fase 0 + 32 añadidos = **84**, mapeados 1:1 contra `APPLICATION_SERVICES.md`.

Las 4 políticas automáticas (`UnirseAHogar`, `ConsumirReserva`, `CompletarObjetivo`, `DerivarEstadoOperativo`) están documentadas explícitamente como ausentes en cada sección relevante — no tienen endpoint propio porque no son invocables por el usuario, consistente con Application Services y la Sección U del DDD.

Endpoints de consulta: no se cuentan 1:1 contra ningún catálogo del DDD porque las proyecciones de lectura (Sección O, M, N, Q) son por definición regenerables y no forman un catálogo cerrado — se diseñaron según necesidad de UI/dashboard razonable a partir de REQUISITES, no contra una lista fuente.

Pendiente heredado, no resuelto en este bloque: endpoints de Movimiento Programado no incluyen visibilidad/propiedad (Sección S, DDD — decisión de dejarlo para más adelante). **→ Resuelto: se heredan del elemento (DDD Sección X; GAPS.md G2 / P12).**
