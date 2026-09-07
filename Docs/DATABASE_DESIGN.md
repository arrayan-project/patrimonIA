# Diseño de Base de Datos — PatrimonIA

> **Migrado de `.docx` a Markdown el 2026-09-06** (el original está en `Docs/_baseline/`). Este `.md` es ahora la fuente de verdad; las decisiones posteriores a Fase 0 se integran aquí y se registran en `GAPS.md`.

*Modelo relacional lógico, trazado 1:1 contra los agregados del DDD (DDD.docx) y los casos de uso de Application Services. Cada tabla referencia su agregado de origen. Los invariantes ya definidos en el dominio se traducen a constraints; donde una regla no es expresable como constraint de esquema, se marca explícitamente “validado en Application Service” con la razón.*

## Convenciones

- PK: `id` (UUID) en toda tabla raíz de agregado.
- Auditoría: tabla propia (ver sección U), no hay campos `created_by`/`updated_by` sueltos en las tablas de dominio — la auditoría vive separada, conforme al Principio C (historial de negocio ≠ auditoría).
- Montos: `NUMERIC(18,2)` mínimo — a definir precisión final según monedas soportadas (Sección S, REQUISITES, pendiente de tipo de cambio).
- Fechas de negocio (`fecha_evento`, etc.) se separan de metadatos técnicos (`created_at` de fila) — la primera es información primaria, la segunda es housekeeping técnico.
- Ninguna tabla de dominio tiene `UPDATE` de valor histórico: los patrones de corrección (Sección T) siempre insertan una fila nueva enlazada, nunca sobrescriben.

# 1. Hogar (Agregado A)

```
hogar
  id UUID PK
  nombre TEXT NOT NULL
  moneda_consolidacion TEXT NOT NULL -- ISO 4217
  created_at TIMESTAMPTZ NOT NULL

 membresia
  id UUID PK
  hogar_id UUID FK -> hogar.id NOT NULL
  usuario_id UUID FK -> usuario.id NOT NULL
  rol TEXT NOT NULL CHECK (rol IN ('ADMINISTRADOR','MIEMBRO'))
  estado TEXT NOT NULL CHECK (estado IN ('ACTIVA','SALIDA'))
  created_at TIMESTAMPTZ NOT NULL
  UNIQUE (hogar_id, usuario_id) WHERE estado = 'ACTIVA'

 invitacion
  id UUID PK
  hogar_id UUID FK -> hogar.id NOT NULL
  emisor_id UUID FK -> usuario.id NOT NULL
  invitado_id UUID FK -> usuario.id NOT NULL
  estado TEXT NOT NULL CHECK (estado IN ('PENDIENTE','ACEPTADA','RECHAZADA'))
  created_at TIMESTAMPTZ NOT NULL
```

Invariantes del agregado → constraint o validación:

| Invariante (DDD Sección A / W) | Mecanismo |
| --- | --- |
| Debe existir al menos un administrador | No expresable como CHECK simple (requiere contar filas relacionadas) → validado en Application Service (AsignarRol, RemoverMiembro) antes de commit |
| No puede eliminarse el último administrador | Igual que arriba — validado en Application Service |
| Toda membresía nace de creación o invitación aceptada (UnirseAHogar) | `membresia` no tiene INSERT directo expuesto — solo se crea desde el caso de uso AceptarInvitacion o CrearHogar. No hay constraint de FK que lo fuerce; es una regla de capa de aplicación, documentada aquí para que quede explícita |

*Nota de diseño: “al menos un administrador” es el primer ejemplo de una clase de invariante que aparece varias veces en este documento — invariantes de cardinalidad sobre un conjunto relacionado no son expresables como CHECK de fila única en SQL estándar. Se resuelven con transacción + validación en el Application Service, nunca solo confiando en la UI.*

# 2. Usuario (Agregado B)

```
usuario
  id UUID PK
  email TEXT NOT NULL UNIQUE
  nombre TEXT NOT NULL
  password_hash TEXT NOT NULL
  preferencias JSONB
  estado TEXT NOT NULL CHECK (estado IN ('ACTIVO','DESACTIVADO'))
  created_at TIMESTAMPTZ NOT NULL
```

Observación del DDD: un usuario puede pertenecer a múltiples hogares (vía `membresia`), y puede existir momentáneamente sin hogar (durante alta) — no hay FK obligatoria `usuario.hogar_id`, la relación vive en `membresia`.

# 3. Elemento Patrimonial (Agregado E) + Propiedad

```
elemento_patrimonial
  id UUID PK
  nombre TEXT NOT NULL
  tipo TEXT NOT NULL -- cuenta_corriente, inmueble, vehiculo, deuda, credito, etc.
  categoria_funcional TEXT NOT NULL CHECK (categoria_funcional IN
  ('LIQUIDEZ','RESERVA','INVERSION','ACTIVO','CREDITO','DEUDA'))
  ambito TEXT NOT NULL CHECK (ambito IN ('PERSONAL','HOGAR'))
  valor_vigente NUMERIC(18,2) NOT NULL
  moneda TEXT NOT NULL -- ISO 4217
  participa_valor_liquido BOOLEAN NOT NULL DEFAULT FALSE
  participa_consolidacion BOOLEAN NOT NULL DEFAULT FALSE
  admite_valorizacion BOOLEAN NOT NULL DEFAULT FALSE
  visibilidad TEXT NOT NULL CHECK (visibilidad IN ('PRIVADA','COMPARTIDA','FAMILIAR'))
  estado TEXT NOT NULL CHECK (estado IN ('ACTIVO','INACTIVO'))
  valor_pendiente NUMERIC(18,2) -- solo aplica a DEUDA/CREDITO; NULL en el resto
  created_at TIMESTAMPTZ NOT NULL

 elemento_propietario
  id UUID PK
  elemento_id UUID FK -> elemento_patrimonial.id NOT NULL
  usuario_id UUID FK -> usuario.id NOT NULL
  porcentaje NUMERIC(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100)
  UNIQUE (elemento_id, usuario_id)
```

*Nota de diseño (decisión de sesión): esta tabla guarda solo el estado vigente — sin vigencia temporal ni historial en fila. Visibilidad, participación en consolidación, participación en valor líquido y propiedad son configuración, no hechos económicos: su historial de cambios vive exclusivamente en Auditoría (Sección U), consistente con el Principio C (historial de negocio ≠ auditoría) y con la Sección V (la reconstrucción de estado se construye desde hechos económicos con fecha — eventos, valorizaciones, ajustes — no desde configuración administrativa). *`*CambiarPropiedadElementoPatrimonial*`* hace UPDATE/reemplazo directo de las filas de *`*elemento_propietario*`*, y el valor anterior/posterior queda en la entrada de auditoría correspondiente, no en esta tabla.*

Invariantes → mecanismo:

| Invariante | Mecanismo |
| --- | --- |
| Al menos un propietario | No expresable a nivel fila — se valida en Application Service al ejecutar Registrar/CambiarPropiedad (no se permite dejar el elemento con 0 filas vigentes en `elemento_propietario`) |
| El hogar nunca es propietario | `elemento_propietario.usuario_id` referencia solo `usuario`, no existe FK hacia `hogar` — estructuralmente imposible, no requiere validación adicional |
| Suma de % de propietarios vigentes = 100% | No expresable como CHECK de fila — se valida en Application Service antes de commit (CambiarPropiedadElementoPatrimonial recalcula y valida la suma) |
| Propiedad modificable durante el ciclo de vida | `CambiarPropiedadElementoPatrimonial` hace UPDATE/reemplazo directo de las filas — solo el valor actual se persiste en `elemento_propietario`; el historial de cambios de propiedad vive en Auditoría, no en esta tabla (ver decisión de sesión sobre configuración vs. hechos económicos, más abajo) |
| Deuda/Crédito: único atributo obligatorio es valor pendiente | `valor_pendiente` es columna nullable en la misma tabla — Deuda/Crédito es una especialización por `categoria_funcional`, no tabla propia (confirmado en Sección T: “no son un agregado nuevo”) |

Decisión de propiedad compartida (confirmada en esta sesión): el % se declara manualmente al crear o al ejecutar `CambiarPropiedadElementoPatrimonial` — no se deriva de aportes históricos. Esto es lo que permite que `elemento_propietario` sea una tabla simple de vigencia, sin necesidad de un historial de aportes por propietario dentro del elemento.

# 4. Evento Financiero (Agregado D) + Impacto Patrimonial (F)

```
evento_financiero
  id UUID PK
  tipo TEXT NOT NULL CHECK (tipo IN
  ('INGRESO','GASTO','TRANSFERENCIA','CONVERSION','PRESTAMO'))
  monto NUMERIC(18,2) NOT NULL
  moneda TEXT NOT NULL
  fecha DATE NOT NULL -- fecha del hecho económico
  asignacion_id UUID FK -> asignacion.id -- NULL si no aplica (opcional)
  movimiento_programado_origen_id UUID FK -> movimiento_programado.id -- NULL si no viene de materialización
  correccion_de_id UUID FK -> evento_financiero.id -- NULL salvo si este evento es compensatorio
  anulado BOOLEAN NOT NULL DEFAULT FALSE
  created_at TIMESTAMPTZ NOT NULL
  -- INMUTABLE tras creación, salvo el flag `anulado` (ver AnularEventoFinanciero)

 impacto_patrimonial
  id UUID PK
  elemento_id UUID FK -> elemento_patrimonial.id NOT NULL
  monto NUMERIC(18,2) NOT NULL -- signo indica entrada/salida
  origen_tipo TEXT NOT NULL CHECK (origen_tipo IN
  ('EVENTO_FINANCIERO','VALORIZACION','AJUSTE_PATRIMONIAL'))
  origen_id UUID NOT NULL -- FK polimórfica: apunta a evento_financiero.id,
  -- valorizacion.id o ajuste_patrimonial.id según origen_tipo
  created_at TIMESTAMPTZ NOT NULL
```

Invariantes → mecanismo:

| Invariante (DDD Sección F, D, T) | Mecanismo |
| --- | --- |
| Impacto no puede existir sin causa de origen | `origen_tipo` + `origen_id` NOT NULL — estructuralmente forzado |
| Si la causa desaparece, sus impactos desaparecen (propagación, Sección W) | No es FK con ON DELETE CASCADE — el evento original nunca se borra físicamente (Sección T: “el evento/valorización/ajuste original permanece intacto e inmutable”). “Desaparecer” = anulación lógica (`anulado = true`), y el Application Service de Anular es quien borra o marca los `impacto_patrimonial` asociados. Se evita CASCADE automático a propósito, porque el dominio distingue anulación (comando explícito, genera auditoría) de eliminación física accidental |
| Transferencia genera ≥2 impactos (salida + entrada) | No expresable como CHECK — validado en Application Service `RegistrarEventoFinanciero` antes de commit (si tipo = TRANSFERENCIA, debe insertar mínimo 2 filas en `impacto_patrimonial`) |
| Evento original permanece intacto e inmutable (patrón de corrección) | No hay UPDATE expuesto sobre columnas de negocio de `evento_financiero` después de creado — `CorregirEventoFinanciero` siempre INSERTa una fila nueva con `correccion_de_id` apuntando a la original |

Nota de diseño — FK polimórfica en `impacto_patrimonial`: es la única polimorfía real del esquema, porque el propio DDD la define así (Impacto Patrimonial “puede originarse desde: Evento Financiero, Valorización, Ajuste Patrimonial” — Sección F). Alternativa considerada y descartada: 3 tablas de impacto separadas (una por origen) — se descarta porque el DDD trata “impacto patrimonial” como un concepto único con reglas únicas (Sección F), no como 3 conceptos distintos; separarlo en 3 tablas duplicaría esas reglas 3 veces. La polimorfía se resuelve a nivel de aplicación (el Application Service siempre conoce el `origen_tipo` al insertar), no a nivel de FK de base de datos.

# 5. Movimiento Programado (agregado propio)

```
movimiento_programado
  id UUID PK
  monto_planificado NUMERIC(18,2) NOT NULL
  moneda TEXT NOT NULL
  fecha_programada DATE NOT NULL
  elemento_destino_id UUID FK -> elemento_patrimonial.id NOT NULL
  observaciones TEXT
  estado TEXT NOT NULL CHECK (estado IN ('PENDIENTE','MATERIALIZADO','CANCELADO'))
  created_at TIMESTAMPTZ NOT NULL
```

*Nota: *`*evento_financiero.movimiento_programado_origen_id*`* es la referencia inversa que enlaza el evento real con su origen planificado, tras *`*MaterializarMovimientoProgramado*`*. No hay FK en sentido contrario obligatoria — un movimiento programado puede no llegar nunca a materializarse (cancelado).

Pendiente explícito heredado de la Sección S del DDD: reglas de visibilidad/propiedad de Movimiento Programado — quedó fuera de este bloque por decisión tuya (“dejemoslo para más adelante”). Esta tabla NO tiene columnas de visibilidad ni propiedad todavía; se agregarán cuando se resuelva ese pendiente.*

# 6. Valorización (Agregado G)

```
valorizacion
  id UUID PK
  elemento_id UUID FK -> elemento_patrimonial.id NOT NULL
  valor_anterior NUMERIC(18,2) NOT NULL
  valor_nuevo NUMERIC(18,2) NOT NULL
  fecha DATE NOT NULL
  correccion_de_id UUID FK -> valorizacion.id -- NULL salvo si es compensatoria
  anulada BOOLEAN NOT NULL DEFAULT FALSE
  created_at TIMESTAMPTZ NOT NULL
  -- INMUTABLE tras creación salvo flag `anulada`
```

Invariantes → mecanismo:

| Invariante | Mecanismo |
| --- | --- |
| Reemplaza valor vigente, no se acumula | `elemento_patrimonial.valor_vigente` se actualiza (UPDATE) al vigente más reciente en el Application Service — `valorizacion` guarda el historial completo, pero el “valor actual” vive desnormalizado en `elemento_patrimonial.valor_vigente` para lectura rápida |
| Cadena recorrible en orden (para AnularValorizacion) | `ORDER BY fecha, created_at` sobre `valorizacion WHERE elemento_id = ? AND anulada = false` — no requiere estructura de lista enlazada, la fecha + timestamp de creación ya dan orden total |
| Corrección reemplaza el valor vigente, nunca se suma (stock, no flujo) | Mismo patrón que Evento Financiero: INSERT nuevo con `correccion_de_id`, nunca UPDATE del original |

# 7. Ajuste Patrimonial (Agregado L)

```
ajuste_patrimonial
  id UUID PK
  elemento_id UUID FK -> elemento_patrimonial.id NOT NULL
  monto NUMERIC(18,2) NOT NULL
  motivo TEXT NOT NULL -- obligatorio, sin excepción (Sección T, W)
  fecha DATE NOT NULL
  correccion_de_id UUID FK -> ajuste_patrimonial.id
  anulado BOOLEAN NOT NULL DEFAULT FALSE
  created_at TIMESTAMPTZ NOT NULL
  CHECK (motivo IS NOT NULL AND motivo <> '')
```

Invariante clave: `motivo` es `NOT NULL` con CHECK adicional de no-vacío — este es uno de los pocos invariantes de la Sección W que sí es expresable directamente como constraint de columna, sin necesitar lógica de aplicación.

# 8. Asignación (Agregado H) + Reserva (I)

```
asignacion
  id UUID PK
  nombre TEXT NOT NULL
  monto_objetivo NUMERIC(18,2) -- nullable: una asignación puede no tener monto objetivo fijo
  objetivo_financiero_id UUID FK -> objetivo_financiero.id -- NULL = asignación independiente
  created_at TIMESTAMPTZ NOT NULL

 reserva
  id UUID PK
  asignacion_id UUID FK -> asignacion.id NOT NULL
  elemento_origen_id UUID FK -> elemento_patrimonial.id NOT NULL
  monto NUMERIC(18,2) NOT NULL CHECK (monto > 0)
  estado TEXT NOT NULL CHECK (estado IN ('ACTIVA','LIBERADA','CONSUMIDA'))
  created_at TIMESTAMPTZ NOT NULL
```

Invariantes → mecanismo:

| Invariante | Mecanismo |
| --- | --- |
| Reserva debe pertenecer a única asignación | FK NOT NULL simple — estructural |
| Suma reservada no excede disponibilidad del elemento origen | No expresable como CHECK de fila (requiere sumar todas las reservas activas del mismo elemento + comparar contra su valor libre) → validado en Application Service `CrearReserva` / `AjustarMontoReserva`, dentro de la misma transacción que el insert |
| Eliminar asignación elimina reservas en cascada y libera valor | Se maneja explícitamente en el Application Service `EliminarAsignacion` (no ON DELETE CASCADE de SQL) — porque “liberar valor hacia elementos origen” no es solo borrar filas, es una operación de negocio que debe generar su propia entrada de auditoría por cada reserva liberada |

# 9. Objetivo Financiero (Agregado J)

```
objetivo_financiero
  id UUID PK
  nombre TEXT NOT NULL
  monto_objetivo NUMERIC(18,2) NOT NULL
  fecha_objetivo DATE -- opcional
  estado TEXT NOT NULL CHECK (estado IN ('EN_PROGRESO','COMPLETADO','CANCELADO'))
  created_at TIMESTAMPTZ NOT NULL
```

Nota: `progreso_acumulado` no es columna — es una proyección calculada (Sección M/N del DDD: “resultado derivado”, “no se persiste como entidad de negocio”). Se calcula en tiempo de consulta sumando `reserva.monto WHERE estado = 'ACTIVA'` para las asignaciones asociadas a este objetivo, o se materializa en una tabla de proyección de lectura separada (ver sección 11) si el cálculo en vivo resulta costoso.

# 10. Presupuesto (Agregado K)

```
presupuesto
  id UUID PK
  tipo TEXT NOT NULL CHECK (tipo IN ('INDIVIDUAL','FAMILIAR'))
  periodicidad TEXT NOT NULL CHECK (periodicidad IN ('PERIODICO','ESPECIFICO'))
  intervalo TEXT -- 'MENSUAL','TRIMESTRAL', etc. — NULL si es específico
  fecha_inicio DATE
  fecha_fin DATE
  ingresos_esperados NUMERIC(18,2)
  gastos_esperados NUMERIC(18,2)
  ahorro_esperado NUMERIC(18,2)
  estado TEXT CHECK (estado IN ('ACTIVO','CERRADO'))
  -- NULL cuando periodicidad = 'PERIODICO' (vigencia calculada por calendario,
  -- no campo persistido — ver nota en DDD Sección K)
  created_at TIMESTAMPTZ NOT NULL
```

Invariante → mecanismo: “presupuesto periódico no requiere estado propio, termina por calendario” se traduce directamente: `estado` queda `NULL` para periódicos, y la vigencia se calcula en consulta comparando `fecha_inicio`/`fecha_fin` (derivados del intervalo) contra la fecha actual — no hay job ni trigger que “cierre” un presupuesto periódico.

# 11. Auditoría (Sección U)

```
auditoria
  id UUID PK
  comando TEXT NOT NULL -- ej. 'RegistrarElementoPatrimonial', 'CorregirValorizacion'
  usuario_id UUID FK -> usuario.id NOT NULL
  fecha_hora TIMESTAMPTZ NOT NULL
  entidad_tipo TEXT NOT NULL -- 'ELEMENTO_PATRIMONIAL','EVENTO_FINANCIERO', etc.
  entidad_id UUID NOT NULL -- FK polimórfica hacia la entidad afectada
  valor_anterior JSONB -- condicional: solo en comandos que modifican campo/monto existente
  valor_posterior JSONB -- condicional: idem
  motivo TEXT -- condicional: obligatorio en Ajuste, Condonación,
  -- Incobrabilidad, Corrección; opcional/ausente en creación
  entidad_relacionada_tipo TEXT -- condicional: p.ej. 'EVENTO_FINANCIERO' en una corrección
  entidad_relacionada_id UUID -- condicional: id de esa entidad relacionada
  encadenada_de_id UUID FK -> auditoria.id -- NULL salvo si esta entrada es una política
  -- que "genera su propia entrada" (Sección U)
  created_at TIMESTAMPTZ NOT NULL
```

Campos universales vs. condicionales (traducción directa de Sección U):

| Campo Sección U | Columna | Obligatoriedad |
| --- | --- | --- |
| Comando ejecutado | `comando` | NOT NULL siempre |
| Usuario responsable | `usuario_id` | NOT NULL siempre |
| Fecha y hora | `fecha_hora` | NOT NULL siempre |
| Entidad(es) afectada(s) | `entidad_tipo` + `entidad_id` | NOT NULL siempre |
| Valor(es) anterior/posterior | `valor_anterior` / `valor_posterior` | NULL si el comando no modifica un campo existente (ej. creación simple) |
| Motivo/justificación | `motivo` | NOT NULL forzado a nivel de Application Service para: RegistrarAjustePatrimonial, CondonarDeuda, DeclararIncobrable, y todo comando `Corregir*` — no se puede expresar como CHECK porque depende del valor de `comando`, no es una regla de columna aislada |
| Referencia a entidad relacionada | `entidad_relacionada_tipo` / `entidad_relacionada_id` | NULL salvo correcciones, consumo automático de reserva, materialización |

Regla de encadenamiento (Sección U) → mecanismo:

- Política 1-a-1 y muda (consumir reserva, derivar estado operativo) → no genera fila propia. Se guarda como parte del `valor_posterior` (JSONB) de la entrada del comando raíz que la disparó — ej. la fila de `RegistrarEventoFinanciero` incluye en su JSON la referencia a la reserva afectada y su nuevo estado, sin crear una segunda fila en `auditoria`.
- Política que se ramifica o tiene valor de consulta propio (completar objetivo, recalcular consolidación multi-hogar) → sí genera fila propia, con `encadenada_de_id` apuntando a la entrada del comando que la originó. Esto es lo que permite reconstruir la cadena completa (Sección V — reconstrucción de responsabilidad) sin ambigüedad.

Por qué `entidad_id` es polimórfica y no un set de FKs nullable: una entrada de auditoría puede referirse a cualquiera de las ~12 entidades del dominio (Elemento Patrimonial, Evento Financiero, Hogar, Usuario, etc.). Modelarlo como 12 columnas FK nullable (`elemento_patrimonial_id`, `evento_financiero_id`, …) es más “seguro” a nivel de integridad referencial de SQL, pero contradice el propio Principio E: la auditoría es un registro de comandos, no una tabla de detalle por entidad. Se prioriza fidelidad al modelo del dominio sobre integridad referencial de esquema — trade-off explícito, no descuido. La verificación de que `entidad_id` apunta a una fila real de `entidad_tipo` se hace a nivel de Application Service, no de FK de base de datos.

# 12. Proyecciones de lectura (Sección O, M, N, Q)

Estas no son tablas de dominio — son vistas materializadas o calculadas en consulta, regenerables íntegramente desde las tablas anteriores (Principio 1). No llevan PK propia con significado de negocio ni participan de ningún FK entrante.

Candidatas (a definir su implementación — vista SQL vs. tabla materializada — en el diseño de API/performance, no aquí):

- `patrimonio_individual(usuario_id)` — suma de `elemento_patrimonial.valor_vigente * elemento_propietario.porcentaje` para elementos activos y participantes en valor líquido/consolidación según corresponda.
- `patrimonio_familiar_consolidado(hogar_id)` — igual, agregado sobre elementos con `participa_consolidacion = true` cuyos propietarios pertenecen al hogar, sin duplicar elementos compartidos (Sección Q — “un elemento participa en una única consolidación de hogar”).
- `progreso_objetivo(objetivo_id)` — suma de `reserva.monto` activas de las asignaciones asociadas al objetivo.
- `desviacion_presupuestaria(presupuesto_id)` — comparación entre montos esperados de `presupuesto` y montos reales agregados desde `evento_financiero` en el período correspondiente.

# Resumen de trazabilidad

| Agregado DDD | Tabla(s) |
| --- | --- |
| A. Hogar | `hogar`, `membresia`, `invitacion` |
| B. Usuario | `usuario` |
| E. Elemento Patrimonial | `elemento_patrimonial`, `elemento_propietario` |
| D. Evento Financiero | `evento_financiero` |
| F. Impacto Patrimonial | `impacto_patrimonial` |
| G. Valorización | `valorizacion` |
| L. Ajuste Patrimonial | `ajuste_patrimonial` |
| Movimiento Programado | `movimiento_programado` |
| H. Asignación | `asignacion` |
| I. Reserva | `reserva` |
| J. Objetivo Financiero | `objetivo_financiero` |
| K. Presupuesto | `presupuesto` |
| U. Auditoría | `auditoria` |
| M/N/O/Q. Proyecciones | vistas calculadas, sin tabla de dominio propia |

Deuda/Crédito: no tiene tabla propia — es `elemento_patrimonial` con `categoria_funcional IN ('DEUDA','CREDITO')` y `valor_pendiente` poblado. Confirmado contra Sección T: “no un agregado nuevo”.

Pendiente explícito (heredado de la Sección S del DDD, no resuelto en este bloque por decisión tuya): visibilidad y propiedad de Movimiento Programado.

Adenda Fases 50–51 (anexada automáticamente — ver Docs/ADENDA-dominio-fases-50-51.md)

Tabla elemento_patrimonial — nueva columna:

naturaleza TEXT NULL salvo DEUDA/CREDITO — Naturaleza de una deuda/crédito: FINANCIERA (crédito/préstamo real) o CUSTODIA_INFORMAL (dinero de un tercero que solo pasa por las cuentas). Obligatoria para categoria_funcional IN ('DEUDA','CREDITO') — por defecto 'FINANCIERA'; NULL en el resto.

`CHECK ck_naturaleza_valores: naturaleza IS NULL OR naturaleza IN ('FINANCIERA','CUSTODIA_INFORMAL'). CHECK ck_naturaleza_categoria: (categoria_funcional IN ('DEUDA','CREDITO') AND naturaleza IS NOT NULL) OR (categoria_funcional NOT IN ('DEUDA','CREDITO') AND naturaleza IS NULL). Migración 023.`

`Backfill: UPDATE elemento_patrimonial SET naturaleza = 'FINANCIERA' WHERE categoria_funcional IN ('DEUDA','CREDITO') AND naturaleza IS NULL.`

Tabla evento_financiero — columna tipo, dominio ampliado (migración 024):

`CHECK (tipo IN ('INGRESO','GASTO','TRANSFERENCIA','CONVERSION','PRESTAMO','SALDO_INICIAL'))`

SALDO_INICIAL — evento generado exclusivamente por RegistrarElementoPatrimonial para la apertura de una cuenta LIQUIDEZ/RESERVA. Un único impacto +valorInicial sobre el elemento recién creado, con fecha = fecha_alta. No editable por comandos de evento.
