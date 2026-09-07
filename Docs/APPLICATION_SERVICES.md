# Application Services — PatrimonIA

> **Migrado de `.docx` a Markdown el 2026-09-06** (el original está en `Docs/_baseline/`). Este `.md` es ahora la fuente de verdad; las decisiones posteriores a Fase 0 se integran aquí y se registran en `GAPS.md`.

*Catálogo de casos de uso, uno por comando de la Sección T (DDD.docx). Cada caso de uso es la capa de orquestación entre la API y el dominio: recibe un DTO, valida, invoca las políticas del agregado, y deja que la auditoría (Sección U) y el recálculo transversal (Sección W) ocurran como consecuencia — no los repite.

Convención: “Recalcula (W)” significa que dispara la Política transversal única de recálculo de la Sección W — no se detalla en cada caso de uso porque ya está definida una sola vez ahí.*

# A. Elemento Patrimonial

## 1. RegistrarElementoPatrimonial

- Input: nombre, tipo, categoría funcional, valor inicial, moneda, propietario(s) (uno o más), configuración de participación en valor líquido, configuración de participación en consolidación, visibilidad inicial.
- Validaciones: al menos un propietario · el hogar no puede figurar como propietario.
- Orquestación: inicializar valor vigente = valor inicial · recalcular patrimonio individual de cada propietario · recalcular consolidación si aplica (W).
- Output: ElementoPatrimonialDTO (id, estado vigente).
- Auditoría: ver Sección U — Creación (usuario, fecha, valor inicial, propietario(s), categoría).

## 2. ActualizarDatosElementoPatrimonial

- Input: id del elemento, campos no patrimoniales a modificar (nombre, categoría descriptiva, notas, etc.).
- Validaciones: el elemento debe existir y estar activo · el campo no debe ser el valor vigente (eso no se toca aquí).
- Orquestación: ninguna sobre patrimonio.
- Output: ElementoPatrimonialDTO actualizado.
- Auditoría: Modificación — campo(s) cambiado(s), valor anterior/posterior.

## 3. CorregirDatosElementoPatrimonial

- Input: id del elemento, campo(s) a corregir, motivo.
- Validaciones: igual que ActualizarDatos, más motivo obligatorio.
- Orquestación: ninguna sobre patrimonio — se marca explícitamente como corrección, no como actualización.
- Output: ElementoPatrimonialDTO actualizado.
- Auditoría: Corrección — distingue de modificación; valor anterior/posterior + motivo.

## 4. CambiarPropiedadElementoPatrimonial

- Input: id del elemento, propietarios entrantes, propietarios salientes.
- Validaciones: debe seguir habiendo ≥1 propietario tras el cambio.
- Orquestación: recalcular patrimonio individual de todos los afectados (salientes y entrantes) · recalcular consolidación (W).
- Output: ElementoPatrimonialDTO con propietarios actualizados.
- Auditoría: Cambio de propiedad — propietarios anteriores/posteriores.

## 5. CambiarVisibilidadElementoPatrimonial

- Input: id del elemento, nueva configuración de visibilidad (por tipo de información: existencia, valor, movimientos, reservas/asignaciones, objetivos, presupuestos, comentarios, documentos).
- Validaciones: solo un propietario puede ejecutar el cambio.
- Orquestación: ninguna sobre patrimonio.
- Output: ElementoPatrimonialDTO con visibilidad actualizada.
- Auditoría: Cambio de visibilidad — valor anterior/posterior.

## 6. CambiarParticipacionEnConsolidacion

- Input: id del elemento, nuevo valor de participación (sí/no).
- Validaciones: ninguna adicional — la propiedad es independiente de la consolidación.
- Orquestación: recalcular consolidación familiar del hogar (W).
- Output: ElementoPatrimonialDTO actualizado.
- Auditoría: Cambio de consolidación — valor anterior/posterior.

## 7. DesactivarElementoPatrimonial

- Input: id del elemento, motivo (opcional).
- Validaciones: el elemento debe estar activo.
- Orquestación: excluir de valor líquido y disponibilidad futura · conservar en historial y consolidación pasada · recalcular patrimonio y consolidación (W).
- Output: ElementoPatrimonialDTO con estado = inactivo.
- Auditoría: Eliminación lógica.

## 8. ReactivarElementoPatrimonial

- Input: id del elemento, motivo.
- Validaciones: el elemento debe estar inactivo (desactivado, no eliminado físicamente).
- Orquestación: volver a incluir en valor líquido/disponibilidad según configuración original · recalcular patrimonio y consolidación (W).
- Output: ElementoPatrimonialDTO con estado = activo, historial de valorizaciones e impactos intacto.
- Auditoría: Reactivación — elemento, fecha, motivo.
- Nota de diseño: comando propio, no un nuevo RegistrarElementoPatrimonial — preserva la misma identidad de entidad y su historial.

## 9. EliminarElementoPatrimonial

- Input: id del elemento, justificación.
- Validaciones: no debe tener impactos patrimoniales reales asociados (si los tiene, el caso de uso correcto es Desactivar, no Eliminar) · justificación obligatoria.
- Orquestación: eliminación física del registro — caso excepcional.
- Output: confirmación de eliminación.
- Auditoría: Eliminación física — caso excepcional, requiere justificación.

# D. Evento Financiero

## 10. RegistrarEventoFinanciero

- Input: tipo de evento (ingreso, gasto, transferencia, conversión, préstamo, ajuste patrimonial), monto, moneda, elemento(s) origen/destino, fecha, asignación asociada (opcional), movimiento programado origen (opcional, si viene de materialización).
- Validaciones: elementos afectados deben existir y estar activos · si es transferencia, debe generar ≥2 impactos (salida + entrada).
- Orquestación: generar impacto(s) patrimoniales · actualizar valor vigente de elemento(s) afectados · actualizar reservas si la asignación está presente (dispara política “Consumir reserva”) · recalcular patrimonio y consolidación · recalcular información derivada (W).
- Output: EventoFinancieroDTO (id, impactos generados).
- Auditoría: Creación — comando, usuario, fecha, monto, elementos afectados. Si dispara consumo de reserva, esa política se registra embebida en esta misma entrada (Sección U).

## 11. AnularEventoFinanciero

- Input: id del evento, motivo.
- Validaciones: el evento debe existir y estar vigente (no ya anulado).
- Orquestación: eliminar impactos patrimoniales asociados · recalcular patrimonio y derivados (W).
- Output: confirmación de anulación.
- Auditoría: Anulación — motivo, evento anulado.

## 12. CorregirEventoFinanciero

- Input: id del evento original, datos corregidos, motivo.
- Validaciones: el evento original debe existir, permanece intacto e inmutable.
- Orquestación: generar evento compensatorio · establecer relación de corrección con el evento original · recalcular patrimonio y derivados (W).
- Output: EventoFinancieroDTO del evento compensatorio, enlazado al original.
- Auditoría: Corrección — evento original, evento compensatorio, motivo.
- Nota: sigue el patrón de corrección general (Sección T): compensa montos (flujo), no reemplaza el registro original.

# Movimiento Programado (agregado propio)

## 13. CrearMovimientoProgramado

- Input: monto planificado, fecha programada, elemento(s) destino, observaciones.
- Validaciones: ninguna sobre patrimonio — no es un hecho económico todavía.
- Orquestación: ninguna sobre patrimonio.
- Output: MovimientoProgramadoDTO (id, estado = pendiente).
- Auditoría: Creación — usuario, monto planificado, fecha programada, elemento(s) destino.

## 14. ActualizarMovimientoProgramado

- Input: id, campos a modificar (monto, fecha, elemento destino, observaciones).
- Validaciones: el movimiento debe estar en estado pendiente (no materializado ni cancelado).
- Orquestación: ninguna sobre patrimonio.
- Output: MovimientoProgramadoDTO actualizado.
- Auditoría: Modificación — campo(s), anterior/posterior.

## 15. MaterializarMovimientoProgramado

- Input: id del movimiento programado, datos confirmados/ajustados al momento de materializar (monto efectivo, fecha efectiva).
- Validaciones: el movimiento debe estar en estado pendiente y con fecha programada alcanzada.
- Orquestación: dispara RegistrarEventoFinanciero (caso de uso #10) con los datos confirmados/ajustados.
- Output: EventoFinancieroDTO generado + referencia al movimiento programado origen.
- Auditoría: Materialización — referencia al movimiento programado origen. Se registra bajo el mismo comando (aparece también referenciado desde el agregado Evento Financiero, Sección T — es un único caso de uso compartido entre ambos agregados).

## 16. CancelarMovimientoProgramado

- Input: id del movimiento, motivo.
- Validaciones: el movimiento debe estar en estado pendiente.
- Orquestación: ninguna sobre patrimonio — no afecta saldos ni métricas históricas.
- Output: confirmación de cancelación.
- Auditoría: Cancelación — motivo.

# G. Valorización

## 17. RegistrarValorizacion

- Input: id del elemento patrimonial, valor nuevo, fecha.
- Validaciones: el elemento debe admitir valorización (configuración explícita, independiente de su categoría funcional).
- Orquestación: reemplazar valor vigente del elemento · conservar valor anterior en historial de valorizaciones (no se acumula, se reemplaza) · generar impacto patrimonial · recalcular patrimonio y consolidación · recalcular información derivada (W).
- Output: ValorizacionDTO (id, valor anterior, valor nuevo).
- Auditoría: Creación — usuario, fecha, valor anterior, valor nuevo.

## 18. AnularValorizacion

- Input: id de la valorización, motivo.
- Validaciones: la cadena de valorizaciones debe ser recorrible en orden, para determinar cuál era el valor vigente inmediatamente antes de la valorización anulada.
- Orquestación: revertir valor vigente al estado anterior a esta valorización · eliminar impacto patrimonial asociado · recalcular patrimonio y derivados (W).
- Output: confirmación de anulación, valor vigente restaurado.
- Auditoría: Anulación — motivo, valorización anulada.

## 19. CorregirValorizacion

- Input: id de la valorización original, valor correcto, motivo.
- Validaciones: la valorización original debe existir y permanecer intacta.
- Orquestación: generar valorización compensatoria enlazada a la original · reemplazar valor vigente por el valor correcto (nunca se suma al anterior — una valorización representa stock, no flujo) · recalcular patrimonio y derivados (W).
- Output: ValorizacionDTO de la valorización compensatoria.
- Auditoría: Corrección — valorización original, valorización compensatoria, motivo.

# L. Ajuste Patrimonial

## 20. RegistrarAjustePatrimonial

- Input: id del elemento afectado, monto, motivo/justificación (obligatorio), fecha.
- Validaciones: motivo/justificación obligatorio — sin él, el comando se rechaza.
- Orquestación: generar impacto patrimonial · recalcular patrimonio y consolidación · recalcular información derivada (W).
- Output: AjustePatrimonialDTO (id, monto, elemento afectado).
- Auditoría: Creación — usuario, fecha, monto, elemento afectado, motivo.
- Nota de uso: mecanismo de excepción — usar solo cuando no existe información suficiente para reconstruir la causa exacta de una diferencia patrimonial. No sustituye a Evento Financiero cuando la causa es reconstruible.

## 21. AnularAjustePatrimonial

- Input: id del ajuste, motivo.
- Validaciones: el ajuste debe existir y estar vigente.
- Orquestación: eliminar impacto patrimonial asociado · recalcular patrimonio y derivados (W).
- Output: confirmación de anulación.
- Auditoría: Anulación — motivo, ajuste anulado.

## 22. CorregirAjustePatrimonial

- Input: id del ajuste original, datos corregidos, motivo.
- Validaciones: el ajuste original debe existir y permanecer intacto.
- Orquestación: generar ajuste compensatorio enlazado al original · recalcular patrimonio y derivados (W).
- Output: AjustePatrimonialDTO del ajuste compensatorio.
- Auditoría: Corrección — ajuste original, ajuste compensatorio, motivo.

# H. Asignación

## 23. CrearAsignacion

- Input: nombre, monto objetivo, objetivo financiero asociado (opcional).
- Validaciones: ninguna sobre patrimonio — una asignación no constituye patrimonio.
- Orquestación: ninguna sobre patrimonio.
- Output: AsignacionDTO (id, estado de financiamiento = sin reservas).
- Auditoría: Creación — usuario, nombre, monto objetivo, objetivo asociado (si aplica).

## 24. ActualizarDatosAsignacion

- Input: id de la asignación, campos a modificar (nombre, monto objetivo).
- Validaciones: la asignación debe existir.
- Orquestación: ninguna sobre patrimonio.
- Output: AsignacionDTO actualizada.
- Auditoría: Modificación — campo(s), valor anterior/posterior.

## 25. CambiarAsociacionAObjetivo

- Input: id de la asignación, objetivo financiero nuevo (o null para desasociar).
- Validaciones: el objetivo nuevo debe existir si se especifica.
- Orquestación: recalcular progreso del objetivo afectado — tanto el anterior (si había) como el nuevo (W).
- Output: AsignacionDTO con asociación actualizada.
- Auditoría: Cambio de asociación — objetivo anterior/posterior.

## 26. EliminarAsignacion

- Input: id de la asignación, motivo.
- Validaciones: ninguna adicional — eliminar una asignación no modifica el patrimonio.
- Orquestación: eliminar todas las reservas asociadas en cascada · liberar el valor reservado de cada una hacia sus elementos origen · recalcular progreso del objetivo si estaba asociado (W).
- Output: confirmación de eliminación, lista de reservas liberadas.
- Auditoría: Eliminación — asignación, reservas eliminadas en cascada.

# I. Reserva

## 27. CrearReserva

- Input: asignación destino, elemento(s) patrimonial(es) origen, monto.
- Validaciones: debe existir disponibilidad suficiente en el/los elemento(s) origen (la suma reservada no puede exceder la disponibilidad de sus fuentes).
- Orquestación: descontar del valor libre del elemento origen · recalcular progreso del objetivo asociado a la asignación, si existe (W).
- Output: ReservaDTO (id, elemento origen, monto, asignación destino).
- Auditoría: Creación — elemento origen, monto, asignación destino.

## 28. AjustarMontoReserva

- Input: id de la reserva, nuevo monto.
- Validaciones: re-validar disponibilidad en el elemento origen para el nuevo monto.
- Orquestación: recalcular valor libre del elemento origen · recalcular progreso del objetivo asociado (W).
- Output: ReservaDTO actualizada.
- Auditoría: Modificación — monto anterior/posterior.

## 29. LiberarReserva

- Input: id de la reserva, motivo.
- Validaciones: la reserva debe existir y estar activa.
- Orquestación: devolver el monto al valor libre del elemento origen · recalcular progreso del objetivo asociado (W).
- Output: confirmación de liberación.
- Auditoría: Liberación — motivo, monto liberado.

*Política interna (no comando): Consumir reserva. Se dispara automáticamente dentro de RegistrarEventoFinanciero (#10) cuando el evento se asocia a una asignación. Ajusta/salda el valor reservado, notifica al usuario (Principio 4), y recalcula progreso de objetivo. Se registra embebida en la entrada de auditoría de RegistrarEventoFinanciero — no tiene caso de uso propio invocable por el usuario.*

# J. Objetivo Financiero

## 30. CrearObjetivoFinanciero

- Input: nombre, monto objetivo, fecha objetivo (opcional).
- Validaciones: ninguna sobre patrimonio.
- Orquestación: estado inicial = En progreso.
- Output: ObjetivoFinancieroDTO (id, progreso = 0).
- Auditoría: Creación — usuario, nombre, monto objetivo, fecha objetivo.

## 31. ActualizarDatosObjetivoFinanciero

- Input: id del objetivo, campos a modificar.
- Validaciones: el objetivo debe existir.
- Orquestación: ninguna sobre patrimonio.
- Output: ObjetivoFinancieroDTO actualizado.
- Auditoría: Modificación — campo(s), valor anterior/posterior.

## 32. CambiarEstadoObjetivoFinanciero (manual)

- Input: id del objetivo, nuevo estado (En progreso / Completado / Cancelado).
- Validaciones: ninguna sobre patrimonio — es el comando universal de transición manual entre cualquier par de estados, incluye reabrir un objetivo Cancelado o Completado.
- Orquestación: ninguna sobre patrimonio ni cascada sobre asignaciones asociadas — el estado es solo una etiqueta de intención · notifica al usuario.
- Output: ObjetivoFinancieroDTO con estado actualizado.
- Auditoría: Cambio de estado — estado anterior/posterior, origen manual.

## 33. EliminarObjetivoFinanciero

- Input: id del objetivo, motivo.
- Validaciones: ninguna adicional — eliminar el objetivo no modifica el patrimonio ni el valor reservado en sus asignaciones.
- Orquestación: desasociar asignaciones — sin cascada, sin tocar su valor reservado (W).
- Output: confirmación de eliminación, lista de asignaciones desasociadas.
- Auditoría: Eliminación — objetivo, asignaciones desasociadas.

*Política interna (no comando): Completar objetivo. Se dispara al recalcular progreso desde Asignación/Reserva y alcanzar el monto objetivo. Cambia estado a Completado, notifica al usuario (Principio 4). Se registra bajo el comando que originó el recálculo (típicamente CrearReserva, AjustarMontoReserva, o el consumo automático dentro de RegistrarEventoFinanciero), con referencia al objetivo afectado — no tiene caso de uso propio.*

# A. Hogar

## 34. CrearHogar

- Input: nombre del hogar, usuario creador.
- Validaciones: ninguna adicional.
- Orquestación: el usuario creador se convierte automáticamente en Administrador.
- Output: HogarDTO (id, administrador = usuario creador).
- Auditoría: Creación — usuario, nombre.

## 35. ActualizarDatosHogar

- Input: id del hogar, campos a modificar (nombre, etc.).
- Validaciones: solo un administrador puede ejecutar el cambio.
- Orquestación: ninguna sobre patrimonio.
- Output: HogarDTO actualizado.
- Auditoría: Modificación — campo(s).

## 36. CambiarMonedaConsolidacion

- Input: id del hogar, nueva moneda de consolidación.
- Validaciones: solo un administrador puede ejecutar el cambio.
- Orquestación: recalcular todas las consolidaciones del hogar en la nueva moneda, usando tipos de cambio vigentes al momento del cálculo (Sección S — Moneda, REQUISITES).
- Output: HogarDTO con moneda de consolidación actualizada.
- Auditoría: Cambio — moneda anterior/posterior.

## 37. InvitarMiembro

- Input: id del hogar, usuario invitado.
- Validaciones: solo un administrador puede invitar.
- Orquestación: genera invitación pendiente.
- Output: InvitacionDTO (id, estado = pendiente).
- Auditoría: Invitación — emisor, invitado.

## 38. AceptarInvitacion

- Input: id de la invitación, usuario que acepta.
- Validaciones: la invitación debe estar pendiente y dirigida a ese usuario.
- Orquestación: dispara la política interna “UnirseAHogar” — crea membresía, rol Miembro estándar por defecto. UnirseAHogar no es invocable directamente: protege el invariante de que toda membresía nace de creación o invitación aceptada.
- Output: MembresiaDTO (usuario, hogar, rol = Miembro estándar).
- Auditoría: Aceptación — usuario, hogar.

## 39. RechazarInvitacion

- Input: id de la invitación, usuario que rechaza.
- Validaciones: la invitación debe estar pendiente y dirigida a ese usuario.
- Orquestación: cierra la invitación pendiente.
- Output: confirmación de rechazo.
- Auditoría: Rechazo — usuario, hogar.

## 40. AsignarRol

- Input: id del hogar, miembro objetivo, rol nuevo (Administrador / Miembro estándar).
- Validaciones: debe quedar al menos un administrador tras el cambio.
- Orquestación: ninguna sobre patrimonio.
- Output: MembresiaDTO con rol actualizado.
- Auditoría: Cambio de rol — anterior/posterior.

## 41. RemoverMiembro

- Input: id del hogar, miembro a remover, motivo.
- Validaciones: el miembro a remover no puede ser el último administrador.
- Orquestación: los elementos individuales del removido quedan intactos, fuera de esta consolidación.
- Output: confirmación de remoción.
- Auditoría: Remoción — miembro, hogar.

## 42. EliminarHogar

- Input: id del hogar, motivo.
- Validaciones: solo un administrador puede ejecutar la eliminación.
- Orquestación: desvincular todos los miembros · los elementos patrimoniales (individuales y compartidos) sobreviven fuera del contenedor de consolidación — la aplicación no es dueña del patrimonio (Principio 3); solo desaparece la entidad organizativa Hogar y sus vínculos de membresía.
- Output: confirmación de eliminación.
- Auditoría: Eliminación — hogar, miembros desvinculados.

# B. Usuario

## 43. RegistrarUsuario

- Input: datos de identidad, credenciales de autenticación.
- Validaciones: ninguna sobre hogar — el usuario puede existir momentáneamente sin hogar durante el flujo de alta.
- Orquestación: ninguna sobre patrimonio.
- Output: UsuarioDTO (id).
- Auditoría: Creación — usuario.

## 44. ActualizarDatosUsuario

- Input: id del usuario, campos a modificar (identidad, preferencias globales).
- Validaciones: ninguna.
- Orquestación: ninguna.
- Output: UsuarioDTO actualizado.
- Auditoría: Modificación — campo(s).

## 45. SalirDeHogar

- Input: id del usuario, id del hogar.
- Validaciones: el usuario no puede ser el último administrador del hogar.
- Orquestación: sus elementos individuales quedan intactos.
- Output: confirmación de salida.
- Auditoría: Salida — usuario, hogar.

## 46. DesactivarUsuario

- Input: id del usuario, motivo.
- Validaciones: ninguna adicional.
- Orquestación: elementos patrimoniales y membresías históricas se conservan.
- Output: confirmación de desactivación.
- Auditoría: Desactivación.

# Deuda / Crédito (especialización de Elemento Patrimonial)

*Heredan todos los casos de uso #1–9 de Elemento Patrimonial sin modificación. Los cambios de valor pendiente se canalizan por RegistrarEventoFinanciero (#10) o RegistrarAjustePatrimonial (#20) — no requieren casos de uso nuevos. Solo dos comandos son propios de esta especialización:*

## 47. CondonarDeuda

- Input: id de la deuda, motivo.
- Validaciones: la deuda debe tener valor pendiente > 0.
- Orquestación: generar impacto patrimonial que lleva el valor pendiente a cero · recalcular patrimonio y consolidación (W) · conservar el elemento para efectos históricos.
- Output: ElementoPatrimonialDTO (deuda) con valor pendiente = 0.
- Auditoría: Condonación — deuda, valor condonado, motivo.

## 48. DeclararIncobrable

- Input: id del crédito, motivo.
- Validaciones: el crédito debe tener valor pendiente > 0.
- Orquestación: generar impacto patrimonial que lleva el valor pendiente a cero · recalcular patrimonio y consolidación (W) · conservar el elemento para efectos históricos.
- Output: ElementoPatrimonialDTO (crédito) con valor pendiente = 0.
- Auditoría: Declaración de incobrabilidad — crédito, valor, motivo.

*Política interna (no comando): Derivar estado operativo. Se recalcula automáticamente tras cualquier evento o ajuste que modifique el valor pendiente de una deuda/crédito. Se registra bajo el comando que lo originó, sin entrada propia de auditoría.

Nota de diseño: CondonarDeuda y DeclararIncobrable se mantienen como comandos separados aunque ambos llevan el valor pendiente a cero — condonar es decisión activa del acreedor, incobrable es reconocimiento de no recuperación. Distinguirlos desde el comando evita deuda técnica si más adelante se requieren efectos legales o contables distintos.*

# K. Presupuesto

## 49. CrearPresupuesto

- Input: tipo (individual/familiar), período o propósito, montos esperados (ingresos, gastos, ahorros, asignaciones esperadas).
- Validaciones: ninguna sobre patrimonio.
- Orquestación: ninguna sobre patrimonio.
- Output: PresupuestoDTO (id).
- Auditoría: Creación — usuario/hogar, tipo, período, montos esperados.

## 50. ActualizarDatosPresupuesto

- Input: id del presupuesto, campos a modificar.
- Validaciones: ninguna sobre patrimonio.
- Orquestación: ninguna sobre patrimonio.
- Output: PresupuestoDTO actualizado.
- Auditoría: Modificación — campo(s), anterior/posterior.

## 51. CerrarPresupuesto

- Input: id del presupuesto (debe ser de tipo específico, no periódico), motivo.
- Validaciones: aplica solo a presupuestos específicos — un presupuesto periódico no requiere cierre, termina por calendario.
- Orquestación: ninguna sobre patrimonio · preserva la comparación presupuesto-vs-real para consulta futura.
- Output: PresupuestoDTO con estado = Cerrado.
- Auditoría: Cierre — presupuesto, fecha, motivo.

## 52. EliminarPresupuesto

- Input: id del presupuesto, motivo.
- Validaciones: ninguna — sin cascada, sin dependientes.
- Orquestación: ninguna.
- Output: confirmación de eliminación.
- Auditoría: Eliminación — presupuesto.

*Nota: se usa Cerrar cuando el presupuesto cumplió su ciclo y se quiere conservar el análisis; se usa Eliminar solo si el presupuesto nunca debió existir (error de carga).*

# Resumen de cobertura

Total: 52 casos de uso invocables por el usuario, mapeados 1:1 contra los comandos de la Sección T (DDD.docx). No se documentan como casos de uso propios las 4 políticas automáticas (UnirseAHogar, Consumir reserva, Completar objetivo, Derivar estado operativo) porque no son invocables directamente — están descritas como nota dentro del caso de uso que las dispara, conforme a la Sección U.

*Nota de reconciliación: la cifra previa de “~44 comandos” mencionada al iniciar este bloque correspondía a un conteo aproximado. El conteo exacto contra la Sección T, comando por comando, da 52. La diferencia son comandos que existen en la tabla pero no se habían sumado en el estimado inicial (p. ej. ActualizarDatosUsuario, ActualizarDatosHogar, ActualizarDatosPresupuesto, ActualizarDatosAsignacion, ActualizarDatosObjetivoFinanciero, ActualizarMovimientoProgramado, RechazarInvitacion). Este documento es la fuente de verdad del conteo, no la cifra estimada al inicio.
