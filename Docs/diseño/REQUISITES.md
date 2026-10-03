# Requerimientos iniciales — PatrimonIA 2.0

**Objetivo:** los requerimientos de producto originales — qué debe hacer la
app, para quién, y con qué reglas de negocio de alto nivel. Es el punto de
partida de todos los demás documentos de diseño (`DDD.md` los formaliza como
modelo de dominio).

> **Migrado de `.docx` a Markdown el 2026-09-06** (el original está en `Docs/_baseline/`). Este `.md` es ahora la fuente de verdad; las decisiones posteriores a Fase 0 se integran aquí y se registran en `GAPS.md`.

## TEMARIO

### A. Gobierno del hogar

1. Existe una entidad principal llamada Hogar/Familia.
2. Un hogar contiene miembros.
3. Existen dos roles:

  - Administrador.
  - Miembro estándar.

1. Todo hogar debe tener al menos un administrador.
2. Un administrador puede invitar nuevos miembros.
3. Un administrador puede asignar roles.

### B. Incorporación de usuarios

1. Todo usuario debe pertenecer a un hogar para utilizar la plataforma.
2. Un usuario puede:

  - Crear un hogar nuevo.
  - Unirse a un hogar existente mediante invitación.

1. El creador de un hogar se convierte automáticamente en administrador.

### C. Modelo financiero base

1. Todo movimiento financiero se clasifica como:

  - Ingreso.
  - Egreso.

1. Ingreso y egreso representan únicamente la dirección del dinero respecto de una cuenta.
2. Todo movimiento se clasifica además como:

  - Interno al hogar.
  - Externo al hogar.

1. Los movimientos internos no alteran el patrimonio total del hogar.
2. Los movimientos externos sí alteran el patrimonio total del hogar.
3. Todo movimiento debe impactar los saldos correspondientes.
4. El hogar mantiene métricas agregadas derivadas de los movimientos y valores patrimoniales.

### D. Modelo de elementos patrimoniales

1. Un elemento patrimonial es cualquier entidad que posea o represente valor económico propio e independiente dentro del patrimonio personal o familiar.

  - Cuenta corriente.
  - Cuenta vista.
  - APV.
  - Fondo mutuo.
  - Vehículo.
  - Inmueble.
  - Crédito por cobrar.
  - Deuda.

1. Todo elemento patrimonial debe poseer un valor económico actual representable en un momento determinado.
2. Un elemento patrimonial puede pertenecer a uno de los siguientes ámbitos:

  - Personal.
  - Hogar.

1. Los elementos patrimoniales personales pertenecen a un miembro específico.
2. Un elemento patrimonial puede pertenecer a una de las siguientes categorías funcionales:

  - Liquidez: Dinero de uso cotidiano y disponible para gastar.
  - Reserva: Dinero separado para un objetivo o necesidad futura.
  - Inversión: Patrimonio destinado a generar rentabilidad o crecimiento.
  - Activo: Bienes con valor económico.
  - Crédito: Dinero que terceros adeudan al miembro o al hogar.
  - Deuda: Obligaciones financieras pendientes del miembro o del hogar.

1. Las categorías funcionales representan comportamiento patrimonial y no productos financieros específicos.

  - Ejemplos: Cuenta Corriente Santander, Cuenta Vista BancoEstado, Cuenta FAN.
  - Pertenecen a: Liquidez.

1. Las agrupaciones son mecanismos de visualización y análisis.No forman parte del patrimonio.

  - Inversiones  ├─ Fintual Conservador  ├─ APV Habitat  └─ Fondo Mutuo
  - "Inversiones" es una agrupación.
  - Los elementos patrimoniales reales son los elementos contenidos.

1. Los elementos patrimoniales son unidades independientes y no requieren un elemento padre para existir.

### E. Asignaciones

1. Una asignación representa un destino o propósito para una parte del valor existente en uno o más elementos patrimoniales.
2. Una asignación no constituye patrimonio. No posee valor propio independiente.
3. Las asignaciones no son propietarias de valor. La propiedad del valor reservado siempre permanece en los elementos patrimoniales que financian la reserva.
4. Eliminar una asignación no modifica el patrimonio.
5. Ejemplos de asignaciones:

  - Vacaciones.
  - Chaqueta.
  - Navidad.
  - Matrícula.
  - Fondo de emergencia virtual.
  - Pie vivienda.

1. Una asignación puede reservar valor proveniente de uno o más elementos patrimoniales sin requerir movimientos reales de dinero.
2. Una reserva representa valor comprometido para un propósito específico dentro de una asignación.
3. El valor reservado continúa formando parte del elemento patrimonial original.
4. Reservar valor en una asignación no modifica el patrimonio total del miembro ni del hogar.
5. Reservar valor en una asignación no genera automáticamente un movimiento financiero.

### F. Relaciones de las asignaciones

1. Un mismo elemento patrimonial puede financiar múltiples asignaciones simultáneamente.
2. Las asignaciones actúan como mecanismos de separación lógica del valor, no como elementos patrimoniales independientes.
3. El valor de una asignación corresponde a valor reservado desde elementos patrimoniales y no constituye patrimonio independiente.
4. Un movimiento puede asociarse opcionalmente a una asignación.
5. Una asignación puede estar asociada a múltiples movimientos a lo largo de su ciclo de vida.
6. Cuando un movimiento se asocia a una asignación, el sistema puede ajustar el valor reservado disponible de dicha asignación.
7. El elemento patrimonial utilizado para ejecutar un movimiento puede ser distinto del elemento patrimonial desde el cual se originó la reserva.
8. El consumo de una asignación no requiere que el movimiento se ejecute desde el mismo elemento patrimonial que financió originalmente la reserva.
9. El sistema debe permitir reflejar separadamente el origen de la reserva y el origen efectivo del movimiento asociado.
10. Una asignación puede contener una o más reservas.
11. Cada reserva representa una porción específica de valor reservado para una asignación determinada.
12. Cada reserva mantiene trazabilidad respecto de los elementos patrimoniales que financian el valor reservado.
13. Una asignación puede contener simultáneamente reservas originadas desde distintos elementos patrimoniales.
14. Las reservas asociadas a una misma asignación conservan su identidad lógica aun cuando compartan un mismo propósito financiero.
15. Las asignaciones no son propietarias de valor. La propiedad del valor reservado siempre permanece en los elementos patrimoniales que financian la reserva.
16. El valor reservado dentro de una asignación conserva las reglas de propiedad, consolidación y visibilidad de los elementos patrimoniales que lo financian.

### G. Ahorro 

1. El sistema debe permitir ahorrar sin requerir la existencia de una cuenta bancaria separada.
2. El ahorro virtual puede representarse mediante reservas asociadas a asignaciones dentro de un mismo elemento patrimonial.
3. El sistema debe permitir complementar una asignación mediante movimientos reales entre elementos patrimoniales.
4. El mismo dinero puede mantenerse en un elemento patrimonial mientras simultáneamente se encuentra reservado parcial o totalmente mediante una o más asignaciones.

### H. Disponibilidad financiera

1. La disponibilidad financiera representa la capacidad real de utilizar recursos económicos existentes para financiar gastos, objetivos o necesidades futuras.
2. El sistema debe distinguir al menos las siguientes métricas financieras:

  - Valor líquido.
  - Valor reservado.
  - Valor libre.

1. El valor líquido corresponde a la suma del valor existente en los elementos patrimoniales marcados como disponibles para uso o rescate.
2. El valor reservado corresponde al valor comprometido mediante asignaciones o reservas financieras.
3. El valor libre corresponde al valor líquido menos el valor reservado.
4. El valor libre representa el monto que puede utilizarse sin afectar reservas u objetivos previamente definidos.
5. La participación de un elemento patrimonial en el cálculo del valor líquido es una configuración explícita del elemento.
6. La participación en el cálculo del valor líquido es independiente de la categoría funcional del elemento patrimonial.
7. Elementos patrimoniales de distintas categorías funcionales pueden participar en el valor líquido si sus propietarios así lo definen.

  - Cuenta corriente.
  - Cuenta vista.
  - Efectivo.
  - Inversiones de rescate rápido.

1. Los elementos patrimoniales no disponibles para uso o rescate no participan en el cálculo del valor líquido.

  - Inmuebles.
  - Vehículos.
  - APV con restricciones.
  - Otros activos no realizables de forma expedita.

1. Toda reserva o asignación debe estar financiada por uno o más elementos patrimoniales específicos.
2. Una asignación puede financiarse desde uno o más elementos patrimoniales simultáneamente.
3. El valor reservado asociado a una asignación se descuenta únicamente de los elementos patrimoniales que la financian.
4. El sistema no debe permitir reservar un valor superior al disponible en los elementos patrimoniales utilizados como fuente de financiamiento.
5. Las reservas no modifican el patrimonio total ni el valor líquido de los elementos patrimoniales.
6. Las reservas modifican únicamente el valor libre disponible para uso futuro.

### I. Propiedad y consolidación patrimonial

1. Todo elemento patrimonial debe tener uno o más propietarios.
2. Un elemento patrimonial puede ser:

  - Individual: pertenece a un único miembro.
  - Compartido: pertenece a dos o más miembros.

1. El hogar no posee patrimonio. El hogar actúa como mecanismo de consolidación patrimonial de sus miembros.
2. El sistema debe calcular patrimonio individual para cada miembro a partir de los elementos patrimoniales de los cuales es propietario o copropietario.
3. El sistema debe calcular patrimonio familiar mediante la consolidación de los elementos patrimoniales incluidos en el hogar.
4. Los elementos patrimoniales individuales pueden participar o no en la consolidación familiar.
5. La participación de un elemento patrimonial individual en la consolidación familiar es una configuración explícita definida por su propietario.
6. Los elementos patrimoniales compartidos participan automáticamente en la consolidación familiar.
7. El sistema debe soportar simultáneamente:

  - Patrimonio individual.
  - Patrimonio familiar consolidado.

1. Las metas, objetivos financieros y asignaciones no constituyen patrimonio ni poseen valor propio independiente. Su función es agrupar, reservar o representar valor existente en elementos patrimoniales.

### J. Deudas y créditos

1. Las deudas y los créditos son elementos patrimoniales.
2. Un crédito representa un derecho económico futuro cuyo valor forma parte del patrimonio de sus propietarios.
3. Una deuda representa una obligación económica futura cuyo valor reduce el patrimonio neto de sus propietarios.
4. l valor pendiente de una deuda o crédito puede aumentar o disminuir a lo largo de su ciclo de vida como consecuencia de eventos financieros, impactos patrimoniales o ajustes patrimoniales debidamente registrados.
5. El estado operativo de una deuda o crédito se deriva automáticamente de su valor pendiente actual y de los eventos financieros asociados.
6. El sistema debe permitir registrar situaciones excepcionales que alteren el ciclo normal de recuperación o pago de una deuda o crédito, incluyendo la condonación y la declaración de incobrabilidad.
7. La condonación o declaración de incobrabilidad de una deuda o crédito debe generar los impactos patrimoniales correspondientes sobre el valor pendiente del elemento patrimonial afectado.
8. Una deuda o crédito cuyo valor pendiente alcance cero deja de producir efectos patrimoniales futuros, sin perjuicio de su conservación para efectos históricos, analíticos y de auditoría.
9. La extinción total de una deuda o crédito no impide el registro posterior de eventos correctivos o ajustes patrimoniales que modifiquen nuevamente su valor pendiente.
10. Los cambios en el valor pendiente de una deuda o crédito deben registrarse mediante eventos financieros, impactos patrimoniales o ajustes patrimoniales, preservando la trazabilidad histórica de las modificaciones realizadas.
11. Las deudas y créditos pueden ser:

  - Individuales: pertenecen a un único miembro.
  - Compartidos: pertenecen a dos o más miembros.

1. Las deudas y créditos utilizan las mismas reglas de propiedad patrimonial definidas para cualquier otro elemento patrimonial.
2. Las deudas y créditos utilizan las mismas reglas de consolidación familiar definidas para cualquier otro elemento patrimonial.
3. Los préstamos otorgados se modelan como créditos patrimoniales.
4. Los préstamos recibidos se modelan como deudas patrimoniales.
5. Las deudas compartidas del hogar se modelan como elementos patrimoniales compartidos entre los miembros correspondientes.
6. El único atributo obligatorio de una deuda o crédito para efectos patrimoniales es su valor pendiente actual.
7. Información adicional puede registrarse opcionalmente cuando exista o resulte relevante:

  - Acreedor.
  - Deudor externo.
  - Fecha de inicio.
  - Fecha de término.
  - Cuota.
  - Tasa de interés.
  - Observaciones.

### K. Modelo Transaccional

1. Un movimiento corresponde a la representación visible para el usuario de un evento financiero registrado por el sistema.
2. Un evento financiero representa un hecho económico capaz de generar uno o más impactos sobre elementos patrimoniales.
3. Un impacto patrimonial representa una modificación sobre un elemento patrimonial específico.
4. Un evento financiero puede generar uno o varios impactos patrimoniales dependiendo de su naturaleza.
5. Los eventos financieros modifican el estado, valor o distribución de uno o más elementos patrimoniales.
6. Un mismo evento financiero puede afectar simultáneamente múltiples elementos patrimoniales.
7. Los impactos patrimoniales constituyen el mecanismo mediante el cual los eventos financieros producen efectos sobre el patrimonio.
8. Una transferencia entre elementos patrimoniales constituye un único evento financiero.
9. Una transferencia genera al menos dos impactos patrimoniales:
10. Un impacto de salida sobre el elemento origen.
11. Un impacto de entrada sobre el elemento destino.
12. Las transferencias no modifican necesariamente el patrimonio total, pero sí pueden modificar su composición.
13. En vistas consolidadas, una transferencia debe visualizarse como un único movimiento.
14. En el historial de cada elemento patrimonial, deben visualizarse los impactos que le afecten directamente.
15. El historial de movimientos muestra eventos financieros relevantes para el usuario.
16. El historial de un elemento patrimonial muestra los impactos patrimoniales asociados a dicho elemento.
17. Los cambios de valorización patrimonial no constituyen movimientos financieros por sí mismos.
18. Las valorizaciones patrimoniales deben registrarse en un historial patrimonial independiente.
19. El sistema debe clasificar los eventos financieros según su naturaleza.
20. El sistema debe soportar al menos los siguientes tipos de eventos financieros:

  - Ingreso.
  - Gasto.
  - Transferencia.
  - Conversión.
  - Préstamo.
  - Ajuste patrimonial.

1. El sistema puede incorporar nuevos tipos de eventos financieros sin alterar las reglas generales del modelo transaccional.
2. La naturaleza económica de un evento financiero no se limita a una única clasificación ni depende exclusivamente del origen y destino de los elementos afectados.
3. El sistema reconoce las siguientes transformaciones económicas base:

  - Ingreso.
  - Gasto.
  - Inversión.
  - Desinversión.
  - Deuda nueva.
  - Pago de deuda.
  - Crédito otorgado.
  - Recuperación de crédito.
  - Transferencia interna.

1. Las transformaciones económicas no actúan como categorías excluyentes, sino como componentes que pueden combinarse para describir los efectos económicos de un mismo evento financiero.
2. La dirección de los impactos patrimoniales no determina por sí sola la naturaleza económica del evento financiero.
3. La interpretación económica surge del análisis completo del evento financiero y de los elementos patrimoniales involucrados.
4. Un mismo evento financiero puede generar simultáneamente múltiples transformaciones económicas.
5. Las transformaciones económicas pueden producir efectos distintos sobre liquidez, activos, deudas y créditos según el perímetro de análisis utilizado.

### L. Objetivos financieros y provisiones

1. El ahorro provisionado corresponde a valor reservado para un uso futuro específico mediante asignaciones y reservas financieras.
2. El ahorro provisionado no constituye patrimonio independiente.
3. El ahorro provisionado continúa formando parte de los elementos patrimoniales que lo financian.
4. El ahorro provisionado afecta únicamente la disponibilidad financiera, reduciendo el valor libre disponible para nuevos usos.
5. El ahorro provisionado no se modela como un tipo de cuenta.
6. El ahorro provisionado no se modela como un tipo de movimiento.
7. El ahorro provisionado no se modela como un elemento patrimonial independiente.
8. El ahorro provisionado se implementa mediante asignaciones y reservas asociadas a elementos patrimoniales existentes.
9. Las reservas representan valor comprometido para un propósito específico dentro de una asignación.
10. Las reservas deben estar financiadas por uno o más elementos patrimoniales específicos.
11. El sistema debe permitir la existencia de objetivos financieros explícitos.
12. Un objetivo financiero es una entidad de planificación y seguimiento financiero.
13. Los objetivos financieros no constituyen patrimonio ni poseen valor económico propio.
14. Los objetivos financieros no almacenan dinero ni modifican el patrimonio.
15. Un objetivo financiero puede definir:

  - Nombre.
  - Monto objetivo.
  - Fecha objetivo (opcional).
  - Estado.
  - Progreso acumulado.

1. El progreso de un objetivo financiero se calcula a partir del valor reservado en las asignaciones asociadas.
2. Un objetivo financiero puede estar asociado a una o múltiples asignaciones.
3. Una asignación puede estar asociada opcionalmente a un objetivo financiero.
4. Un objetivo financiero puede existir sin asignaciones asociadas. En tal caso su progreso acumulado será cero.
5. El sistema debe permitir asignaciones que no estén asociadas a ningún objetivo financiero.
6. Las asignaciones independientes representan propósitos de reserva que no requieren una meta financiera explícita.
7. Eliminar un objetivo financiero no modifica el patrimonio ni el valor reservado existente en sus asignaciones asociadas.

### M. Visibilidad y privacidad

1. No todos los miembros del hogar pueden ver toda la información existente dentro del sistema.
2. La visibilidad de la información debe ser configurable según las reglas definidas por sus propietarios.
3. La participación de un elemento patrimonial en la consolidación familiar no implica automáticamente acceso completo a su información.
4. El sistema debe soportar distintos niveles de visibilidad para los elementos patrimoniales y demás entidades financieras.
5. La visibilidad puede definirse como:
6. Privada.
7. Compartida.
8. Familiar.
9. La visibilidad privada restringe el acceso a los propietarios del elemento.
10. La visibilidad compartida permite acceso a miembros específicos autorizados por los propietarios.
11. La visibilidad familiar permite acceso a todos los miembros del hogar.
12. La visibilidad puede configurarse independientemente para distintos tipos de información.
13. El sistema debe permitir controlar al menos la visibilidad de:

  - Existencia del elemento.
  - Valor económico.
  - Movimientos asociados.
  - Reservas y asignaciones asociadas.
  - Objetivos financieros asociados.
  - Presupuestos asociados.
  - Comentarios y observaciones.
  - Documentos y archivos adjuntos.

1. Los propietarios pueden definir qué información es visible para otros miembros dentro de los límites establecidos por el sistema.
2. Un hogar puede contener elementos patrimoniales completamente privados.
3. Los elementos patrimoniales privados continúan perteneciendo a sus propietarios aun cuando formen parte de un hogar.
4. Un elemento patrimonial privado puede participar o no en la consolidación patrimonial familiar según la configuración definida por sus propietarios.
5. La privacidad de un elemento patrimonial es independiente de su participación en la consolidación familiar.
6. La existencia de elementos patrimoniales privados no altera los cálculos de propiedad patrimonial definidos previamente.
7. Los administradores del hogar no obtienen acceso automático a la información privada de otros miembros por el hecho de poseer privilegios administrativos.
8. Los privilegios administrativos permiten gestionar el hogar, sus miembros y configuraciones, pero no anulan las reglas de privacidad patrimonial definidas por los propietarios.

### N. Presupuestos

1. La plataforma no se limita al registro histórico de movimientos financieros.
2. La plataforma debe permitir planificación financiera mediante presupuestos.
3. Un presupuesto es una entidad de planificación financiera que representa ingresos, gastos, ahorros o asignaciones esperadas para un período o propósito determinado.
4. Los presupuestos no constituyen patrimonio ni modifican directamente el patrimonio existente.
5. Los presupuestos no generan movimientos financieros automáticamente.
6. Un presupuesto puede ser individual o familiar.
7. Un presupuesto individual pertenece a un miembro específico.
8. Un presupuesto familiar se asocia al patrimonio familiar consolidado del hogar.
9. Un presupuesto puede ser periódico o específico.
10. Un presupuesto periódico se asocia a un intervalo temporal definido.

  - Mensual.
  - Trimestral.
  - Semestral.
  - Anual.
  - Otro período definido por el usuario.

1. Un presupuesto específico se asocia a un objetivo, evento o propósito determinado y no requiere periodicidad.
2. Un presupuesto puede definir montos esperados para ingresos, gastos, ahorro o asignaciones.
3. El sistema debe permitir comparar valores presupuestados con valores reales observados.
4. Las desviaciones entre presupuesto y ejecución deben poder calcularse y visualizarse.

### O. Temporalidad

1. Los movimientos programados no se ejecutan automáticamente sobre el patrimonio ni los saldos financieros.
2. Al llegar su fecha programada, un movimiento programado debe quedar disponible para materialización, confirmación o cancelación.
3. El usuario debe poder modificar los datos planificados antes de materializar el movimiento.
4. El usuario puede ajustar, entre otros:

  - Monto.
  - Fecha efectiva.
  - Observaciones.
  - Información complementaria.

1. La materialización de un movimiento programado genera un movimiento financiero real e independiente.
2. El sistema debe conservar separadamente la información planificada y la información finalmente ejecutada.
3. Los movimientos programados cancelados no afectan patrimonio, saldos ni métricas históricas.

### P. Auditoría e historial

1. El sistema debe permitir la modificación de movimientos históricos cuando sea necesario corregir información previamente registrada.
2. La modificación de un movimiento no debe eliminar automáticamente la evidencia de su estado anterior.
3. Las modificaciones deben preservar la integridad histórica de la información financiera y patrimonial.
4. El sistema debe registrar las correcciones realizadas sobre movimientos históricos.
5. El sistema debe permitir registrar ajustes patrimoniales independientes de los movimientos financieros ordinarios.
6. Las correcciones y los ajustes deben diferenciarse conceptualmente para efectos de análisis, auditoría e historial.
7. Las correcciones representan modificaciones sobre información previamente registrada.
8. Los ajustes representan cambios patrimoniales que no corresponden necesariamente a movimientos financieros tradicionales.
9. El sistema debe mantener trazabilidad de los cambios relevantes realizados sobre la información financiera y patrimonial.
10. La trazabilidad debe registrar al menos:

  - Usuario responsable.
  - Fecha y hora.
  - Tipo de acción realizada.
  - Valores anteriores.
  - Valores posteriores.

1. El sistema debe registrar eventos relevantes asociados, al menos, a:

  - Creación.
  - Modificación.
  - Eliminación lógica.
  - Materialización de movimientos programados.
  - Cambios de propiedad.
  - Cambios de consolidación patrimonial.
  - Cambios de visibilidad.
  - Cambios de valoración patrimonial.

1. El historial de auditoría forma parte de la integridad del sistema.
2. Los usuarios finales no pueden modificar directamente los registros de auditoría.
3. La eliminación de información financiera o patrimonial debe realizarse mediante eliminación lógica cuando corresponda preservar trazabilidad histórica.
4. La eliminación lógica no debe destruir el historial de auditoría asociado.
5. El sistema debe permitir reconstruir el estado histórico de una entidad a partir de la información registrada en la auditoría.

### Q. Alcance patrimonial

1. La plataforma no se limita a la gestión de dinero y flujo de caja.
2. La plataforma debe permitir la gestión integral del patrimonio personal y familiar.
3. El patrimonio puede estar compuesto por cualquier elemento que posea o represente valor económico propio e independiente.
4. El sistema debe soportar al menos los siguientes tipos de elementos patrimoniales:

  - Liquidez.
  - Inversiones.
  - Activos físicos.
  - Negocios.
  - Créditos.
  - Deudas.

1. Los activos patrimoniales pueden incluir, entre otros:

  - Inmuebles.
  - Vehículos.
  - Participaciones societarias.
  - Negocios.
  - Acciones.
  - Fondos de inversión.
  - Otros activos con valor económico.

1. Todos los elementos patrimoniales deben utilizar las mismas reglas generales de propiedad, consolidación, visibilidad y auditoría definidas por el sistema.
2. El sistema registra el valor patrimonial de un activo, pero no está obligado a gestionar la operación interna asociada a dicho activo.

### R. Valorizaciones patrimoniales

1. Un elemento patrimonial puede admitir procesos de valorización cuando su valor económico sea susceptible de variar a lo largo del tiempo.
2. La participación de un elemento patrimonial en procesos de valorización constituye una configuración explícita del elemento y es independiente de su categoría funcional.
3. Cada valorización actualiza el valor vigente del elemento patrimonial afectado, preservando simultáneamente el historial de valorizaciones registradas.
4. Reemplaza el valor vigente y conserva historial.
5. Un proceso de valorización corresponde a la actualización del valor económico de un elemento patrimonial sin que exista necesariamente un movimiento financiero asociado.

### S. Moneda

1. La plataforma no será monomoneda.
2. La plataforma debe permitir la coexistencia de múltiples monedas dentro de un mismo hogar.
3. La capacidad multimoneda forma parte del modelo base del sistema y no constituye una extensión opcional.
4. Todo elemento patrimonial debe poseer una moneda de referencia asociada.
5. Todo movimiento financiero debe registrarse en su moneda original.
6. Las reservas, asignaciones, presupuestos y objetivos financieros pueden expresarse en una moneda determinada.
7. El sistema debe permitir gestionar simultáneamente elementos patrimoniales, movimientos y planificación financiera en distintas monedas.
8. Un mismo hogar puede contener activos, deudas, créditos, inversiones y cuentas expresados en diferentes monedas.
9. El sistema debe conservar la moneda original y el valor original registrados para cada elemento patrimonial.
10. El sistema puede calcular valores equivalentes en una moneda de consolidación para efectos de análisis, comparación y patrimonio consolidado.
11. La moneda de consolidación corresponde a la moneda utilizada para presentar métricas agregadas dentro del sistema.
12. La moneda de consolidación se configura a nivel de hogar.
13. La moneda de consolidación inicial puede sugerirse según el país de configuración del hogar.
14. Los tipos de cambio utilizados para conversiones deben registrarse y conservarse históricamente.
15. La modificación posterior de un tipo de cambio no debe alterar reconstrucciones históricas previamente registradas.
16. Los cálculos de patrimonio consolidado deben utilizar mecanismos de conversión monetaria consistentes, reproducibles y auditables.
17. El sistema debe permitir valorar elementos patrimoniales expresados en monedas fiduciarias, unidades de cuenta o instrumentos equivalentes utilizados en los mercados donde opere.
18. Las conversiones monetarias utilizadas para análisis histórico deben poder reconstruirse utilizando los tipos de cambio vigentes al momento del cálculo o registro correspondiente.

Punto revisado

1. Consistencia global (buscar contradicciones entre estatutos).

### Punto a revisar

1. ~~Definición del modelo de dominio (agregados, entidades y relaciones).~~ →
   **hecho**: `DDD.md`.

### Puntos pendientes

Todos cerrados (estado al 2026-09-27; lo abierto hoy vive en `../../GAPS.md` →
Parte 1):

1. ~~Diseño de la base de datos.~~ → `DATABASE_DESIGN.md` + `api/db/`.
2. ~~Diseño de APIs y casos de uso.~~ → `API_DESIGN.md` + `APPLICATION_SERVICES.md`.
3. ~~Diseño UX/flujos de usuario.~~ → `UX_FLOWS.md`.

### Caso de uso típico

- Recibo mi sueldo en mi cuenta corriente.
- Transfiero parte del dinero a mi cuenta rut
- Pago el mercado desde cuenta rut.
- Le transfiero a mi esposa para que ella pague netflix desde cuenta corriente.
- Pago la luz desde cuenta corriente.
- Aparto dinero para ahorro provisional "mantencion auto", entonces transfiero dinero desde mi cuenta corriente a mi cuenta de fintual a un item con el mismo nombre. Desde cuenta corriente - Aparto dinero para ahorrar en mi futura casa, tambien esta en fintual. La cuenta de fintual es la misma pero tengo como "items" distintos. Desde cuenta corriente
- Pagué el mercado de mis papás. Ellos me devolverán el dinero en 3 días. Desde cuenta corriente
- Mi esposa Zoily me transfirió dinero para que yo compre una aspiradora. Ambos aportamos yo con saldo de mi cuenta + lo que ella me pasó. Desde cuenta rut.
- Pagué spotify. Desde cuenta rut.
- Sigo teniendo dinero en ambas cuentas corriente y rut.
- Un amigo me transfirió dinero a mi cuenta rut para comprarle algo a él. Se lo compro, por lo que el dinero X que entró tambien salió.
- Llega fin de mes y me queda un poco de saldo en ambas cuentas. Finalmente las sumo y las transfiero a la cuenta de fintual para el objetivo Casa.
- Mis cuentas quedan en 0, y al otro día me depositan en mi cuenta corriente.

22
