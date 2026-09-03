-- ============================================================================
-- PatrimonIA — DDL PostgreSQL
-- Traducción mecánica de DATABASE_DESIGN.docx. No introduce reglas nuevas.
-- Orden de creación: resuelto por dependencias de FK, no por orden del DDD.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- para gen_random_uuid()

-- ============================================================================
-- 2. Usuario (Agregado B)
-- ============================================================================

CREATE TABLE usuario (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    nombre          TEXT NOT NULL,
    password_hash   TEXT NOT NULL,
    preferencias    JSONB,
    estado          TEXT NOT NULL CHECK (estado IN ('ACTIVO', 'DESACTIVADO')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 1. Hogar (Agregado A)
-- ============================================================================

CREATE TABLE hogar (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre                TEXT NOT NULL,
    moneda_consolidacion  TEXT NOT NULL,  -- ISO 4217
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE membresia (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hogar_id    UUID NOT NULL REFERENCES hogar(id),
    usuario_id  UUID NOT NULL REFERENCES usuario(id),
    rol         TEXT NOT NULL CHECK (rol IN ('ADMINISTRADOR', 'MIEMBRO')),
    estado      TEXT NOT NULL CHECK (estado IN ('ACTIVA', 'SALIDA')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invariante: solo una membresía ACTIVA por (hogar, usuario) — índice único parcial
CREATE UNIQUE INDEX ux_membresia_activa ON membresia (hogar_id, usuario_id) WHERE estado = 'ACTIVA';
CREATE INDEX ix_membresia_hogar ON membresia (hogar_id) WHERE estado = 'ACTIVA';
CREATE INDEX ix_membresia_usuario ON membresia (usuario_id) WHERE estado = 'ACTIVA';

CREATE TABLE invitacion (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hogar_id      UUID NOT NULL REFERENCES hogar(id),
    emisor_id     UUID NOT NULL REFERENCES usuario(id),
    invitado_id   UUID NOT NULL REFERENCES usuario(id),
    estado        TEXT NOT NULL CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_invitacion_invitado_pendiente ON invitacion (invitado_id) WHERE estado = 'PENDIENTE';
CREATE INDEX ix_invitacion_hogar_pendiente ON invitacion (hogar_id) WHERE estado = 'PENDIENTE';

-- ============================================================================
-- 3. Elemento Patrimonial (Agregado E) + Propiedad
-- ============================================================================

CREATE TABLE elemento_patrimonial (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre                    TEXT NOT NULL,
    tipo                      TEXT NOT NULL,  -- cuenta_corriente, inmueble, vehiculo, deuda, credito, etc.
    categoria_funcional       TEXT NOT NULL CHECK (categoria_funcional IN
                               ('LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'CREDITO', 'DEUDA')),
    ambito                    TEXT NOT NULL CHECK (ambito IN ('PERSONAL', 'HOGAR')),
    valor_vigente             NUMERIC(18,2) NOT NULL,
    moneda                    TEXT NOT NULL,  -- ISO 4217
    participa_valor_liquido   BOOLEAN NOT NULL DEFAULT FALSE,
    participa_consolidacion   BOOLEAN NOT NULL DEFAULT FALSE,
    admite_valorizacion       BOOLEAN NOT NULL DEFAULT FALSE,
    visibilidad               TEXT NOT NULL CHECK (visibilidad IN ('PRIVADA', 'COMPARTIDA', 'FAMILIAR')),
    estado                    TEXT NOT NULL CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    valor_pendiente           NUMERIC(18,2),  -- solo DEUDA/CREDITO; NULL en el resto
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_valor_pendiente_categoria CHECK (
        (categoria_funcional IN ('DEUDA', 'CREDITO') AND valor_pendiente IS NOT NULL)
        OR (categoria_funcional NOT IN ('DEUDA', 'CREDITO') AND valor_pendiente IS NULL)
    )
);

CREATE INDEX ix_elemento_estado ON elemento_patrimonial (estado);
CREATE INDEX ix_elemento_categoria ON elemento_patrimonial (categoria_funcional);

CREATE TABLE elemento_propietario (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elemento_id   UUID NOT NULL REFERENCES elemento_patrimonial(id),
    usuario_id    UUID NOT NULL REFERENCES usuario(id),
    porcentaje    NUMERIC(5,2) NOT NULL CHECK (porcentaje > 0 AND porcentaje <= 100),

    UNIQUE (elemento_id, usuario_id)
);

CREATE INDEX ix_elemento_propietario_usuario ON elemento_propietario (usuario_id);
CREATE INDEX ix_elemento_propietario_elemento ON elemento_propietario (elemento_id);

-- Nota: "al menos un propietario" y "suma de % = 100%" no son expresables como
-- CHECK de fila — se validan en Application Service (ver DATABASE_DESIGN.docx,
-- tabla de invariantes de la sección 3).

-- ============================================================================
-- 9. Objetivo Financiero (Agregado J)
-- Se crea antes de Asignación porque asignacion la referencia.
-- ============================================================================

CREATE TABLE objetivo_financiero (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          TEXT NOT NULL,
    monto_objetivo  NUMERIC(18,2) NOT NULL,
    fecha_objetivo  DATE,  -- opcional
    estado          TEXT NOT NULL CHECK (estado IN ('EN_PROGRESO', 'COMPLETADO', 'CANCELADO')),
    usuario_id      UUID REFERENCES usuario(id),  -- migración 001: objetivo personal (GAPS.md G13)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_objetivo_estado ON objetivo_financiero (estado);
CREATE INDEX ix_objetivo_usuario ON objetivo_financiero (usuario_id);

-- Nota: progreso_acumulado NO es columna — proyección calculada (ver sección 12).

-- ============================================================================
-- 8. Asignación (Agregado H) + Reserva (I)
-- Se crea antes de Evento Financiero porque evento_financiero la referencia.
-- ============================================================================

CREATE TABLE asignacion (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre                   TEXT NOT NULL,
    monto_objetivo           NUMERIC(18,2),  -- nullable
    objetivo_financiero_id   UUID REFERENCES objetivo_financiero(id),  -- NULL = asignación independiente
    usuario_id               UUID REFERENCES usuario(id),  -- migración 001: asignación personal (GAPS.md G13)
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_asignacion_objetivo ON asignacion (objetivo_financiero_id) WHERE objetivo_financiero_id IS NOT NULL;
CREATE INDEX ix_asignacion_usuario ON asignacion (usuario_id);

CREATE TABLE reserva (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asignacion_id       UUID NOT NULL REFERENCES asignacion(id),
    elemento_origen_id  UUID NOT NULL REFERENCES elemento_patrimonial(id),
    monto               NUMERIC(18,2) NOT NULL CHECK (monto > 0),
    estado              TEXT NOT NULL CHECK (estado IN ('ACTIVA', 'LIBERADA', 'CONSUMIDA')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_reserva_asignacion ON reserva (asignacion_id);
CREATE INDEX ix_reserva_elemento_activa ON reserva (elemento_origen_id) WHERE estado = 'ACTIVA';

-- Nota: "suma reservada no excede disponibilidad" no es CHECK de fila —
-- validado en Application Service (CrearReserva / AjustarMontoReserva).

-- ============================================================================
-- 5. Movimiento Programado (agregado propio)
-- Se crea antes de Evento Financiero porque evento_financiero lo referencia.
-- ============================================================================

CREATE TABLE movimiento_programado (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monto_planificado    NUMERIC(18,2) NOT NULL,
    moneda               TEXT NOT NULL,
    fecha_programada     DATE NOT NULL,
    elemento_destino_id  UUID NOT NULL REFERENCES elemento_patrimonial(id),
    observaciones        TEXT,
    estado               TEXT NOT NULL CHECK (estado IN ('PENDIENTE', 'MATERIALIZADO', 'CANCELADO')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_movimiento_programado_pendiente ON movimiento_programado (fecha_programada) WHERE estado = 'PENDIENTE';

-- Pendiente heredado del DDD (Sección S): sin columnas de visibilidad/propiedad todavía.

-- ============================================================================
-- 4. Evento Financiero (Agregado D) + Impacto Patrimonial (F)
-- ============================================================================

CREATE TABLE evento_financiero (
    id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                              TEXT NOT NULL CHECK (tipo IN
                                       ('INGRESO', 'GASTO', 'TRANSFERENCIA', 'CONVERSION', 'PRESTAMO')),
    monto                             NUMERIC(18,2) NOT NULL,
    moneda                            TEXT NOT NULL,
    fecha                             DATE NOT NULL,
    asignacion_id                     UUID REFERENCES asignacion(id),
    movimiento_programado_origen_id   UUID REFERENCES movimiento_programado(id),
    correccion_de_id                  UUID REFERENCES evento_financiero(id),
    anulado                           BOOLEAN NOT NULL DEFAULT FALSE,
    glosa                             TEXT,   -- migración 009: anotación libre (GAPS.md G22)
    categoria_id                      UUID,   -- migración 009: FK a categoria_movimiento (G23)
    created_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
    -- INMUTABLE tras creación salvo el flag `anulado`.
);

CREATE INDEX ix_evento_asignacion ON evento_financiero (asignacion_id) WHERE asignacion_id IS NOT NULL;
CREATE INDEX ix_evento_correccion ON evento_financiero (correccion_de_id) WHERE correccion_de_id IS NOT NULL;
CREATE INDEX ix_evento_fecha ON evento_financiero (fecha);
CREATE INDEX ix_evento_categoria ON evento_financiero (categoria_id) WHERE categoria_id IS NOT NULL;

CREATE TABLE impacto_patrimonial (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elemento_id   UUID NOT NULL REFERENCES elemento_patrimonial(id),
    monto         NUMERIC(18,2) NOT NULL,  -- signo indica entrada/salida
    origen_tipo   TEXT NOT NULL CHECK (origen_tipo IN
                   ('EVENTO_FINANCIERO', 'VALORIZACION', 'AJUSTE_PATRIMONIAL',
                    'CONDONACION', 'DECLARACION_INCOBRABLE')),  -- migración 003
    origen_id     UUID NOT NULL,  -- FK polimórfica: resuelta en Application Service, no en DB
    fecha         DATE NOT NULL,  -- migración 004: fecha del hecho económico origen (reconstrucción histórica, DDD §V)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_impacto_elemento ON impacto_patrimonial (elemento_id);
CREATE INDEX ix_impacto_origen ON impacto_patrimonial (origen_tipo, origen_id);
CREATE INDEX ix_impacto_fecha ON impacto_patrimonial (fecha);

-- ============================================================================
-- 6. Valorización (Agregado G)
-- ============================================================================

CREATE TABLE valorizacion (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elemento_id       UUID NOT NULL REFERENCES elemento_patrimonial(id),
    valor_anterior    NUMERIC(18,2) NOT NULL,
    valor_nuevo       NUMERIC(18,2) NOT NULL,
    fecha             DATE NOT NULL,
    correccion_de_id  UUID REFERENCES valorizacion(id),
    anulada           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    -- INMUTABLE tras creación salvo el flag `anulada`.
);

CREATE INDEX ix_valorizacion_elemento_fecha ON valorizacion (elemento_id, fecha, created_at) WHERE anulada = FALSE;

-- ============================================================================
-- 7. Ajuste Patrimonial (Agregado L)
-- ============================================================================

CREATE TABLE ajuste_patrimonial (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    elemento_id       UUID NOT NULL REFERENCES elemento_patrimonial(id),
    monto             NUMERIC(18,2) NOT NULL,
    motivo            TEXT NOT NULL,
    fecha             DATE NOT NULL,
    correccion_de_id  UUID REFERENCES ajuste_patrimonial(id),
    anulado           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_motivo_no_vacio CHECK (motivo <> '')
);

CREATE INDEX ix_ajuste_elemento ON ajuste_patrimonial (elemento_id);

-- ============================================================================
-- 10. Presupuesto (Agregado K)
-- ============================================================================

CREATE TABLE presupuesto (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                 TEXT NOT NULL CHECK (tipo IN ('INDIVIDUAL', 'FAMILIAR')),
    periodicidad         TEXT NOT NULL CHECK (periodicidad IN ('PERIODICO', 'ESPECIFICO')),
    intervalo            TEXT,  -- 'MENSUAL','TRIMESTRAL', etc. — NULL si es específico
    fecha_inicio         DATE,
    fecha_fin            DATE,
    ingresos_esperados   NUMERIC(18,2),
    gastos_esperados     NUMERIC(18,2),
    ahorro_esperado      NUMERIC(18,2),
    estado               TEXT CHECK (estado IN ('ACTIVO', 'CERRADO')),
                         -- NULL cuando periodicidad = 'PERIODICO' (vigencia por calendario)
    usuario_id           UUID REFERENCES usuario(id),  -- migración 002: creador (GAPS.md G15)
    hogar_id             UUID REFERENCES hogar(id),    -- migración 002: solo si tipo = FAMILIAR
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Invariante: estado solo tiene sentido para presupuestos ESPECIFICOs
    CONSTRAINT ck_estado_periodicidad CHECK (
        (periodicidad = 'PERIODICO' AND estado IS NULL)
        OR (periodicidad = 'ESPECIFICO')
    ),
    -- Invariante (migración 002): FAMILIAR lleva hogar; INDIVIDUAL no
    CONSTRAINT ck_presupuesto_propietario CHECK (
        (tipo = 'FAMILIAR'   AND hogar_id IS NOT NULL)
        OR (tipo = 'INDIVIDUAL' AND hogar_id IS NULL)
    )
);

CREATE INDEX ix_presupuesto_tipo    ON presupuesto (tipo);
CREATE INDEX ix_presupuesto_usuario ON presupuesto (usuario_id);
CREATE INDEX ix_presupuesto_hogar   ON presupuesto (hogar_id);
-- presupuesto_linea (presupuesto por rubro) se define en la sección 16,
-- después de categoria_movimiento a la que referencia.

-- ============================================================================
-- 11. Auditoría (Sección U)
-- ============================================================================

CREATE TABLE auditoria (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comando                   TEXT NOT NULL,
    usuario_id                UUID NOT NULL REFERENCES usuario(id),
    fecha_hora                TIMESTAMPTZ NOT NULL,
    entidad_tipo               TEXT NOT NULL,
    entidad_id                 UUID NOT NULL,  -- FK polimórfica, resuelta en Application Service
    valor_anterior              JSONB,
    valor_posterior              JSONB,
    motivo                        TEXT,
    entidad_relacionada_tipo       TEXT,
    entidad_relacionada_id          UUID,
    encadenada_de_id                 UUID REFERENCES auditoria(id),
    created_at                        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_auditoria_entidad ON auditoria (entidad_tipo, entidad_id);
CREATE INDEX ix_auditoria_usuario ON auditoria (usuario_id);
CREATE INDEX ix_auditoria_comando ON auditoria (comando);
CREATE INDEX ix_auditoria_fecha ON auditoria (fecha_hora);
CREATE INDEX ix_auditoria_encadenada ON auditoria (encadenada_de_id) WHERE encadenada_de_id IS NOT NULL;

-- ============================================================================
-- 12. Notificaciones (migración 005 — infraestructura, NO dominio)
-- Registro in-app del "se notifica al usuario" del Principio 4. No genera
-- auditoría, se puede regenerar. El envío push/email queda fuera de alcance.
-- ============================================================================

CREATE TABLE notificacion (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id     UUID NOT NULL REFERENCES usuario(id),
    tipo           TEXT NOT NULL,
    titulo         TEXT NOT NULL,
    cuerpo         TEXT NOT NULL,
    entidad_tipo   TEXT,
    entidad_id     UUID,
    leida          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_notificacion_usuario ON notificacion (usuario_id, created_at DESC);
CREATE INDEX ix_notificacion_no_leida ON notificacion (usuario_id) WHERE leida = FALSE;

-- Expo push tokens de los dispositivos del usuario (migración 008)
CREATE TABLE dispositivo_push (
    usuario_id       UUID NOT NULL REFERENCES usuario(id),
    expo_push_token  TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, expo_push_token)
);

CREATE INDEX ix_dispositivo_push_usuario ON dispositivo_push (usuario_id);

-- ============================================================================
-- 13. Idempotencia de comandos (migración 006 — infraestructura de API)
-- Guarda la respuesta ya emitida para una (Idempotency-Key, usuario).
-- ============================================================================

CREATE TABLE idempotencia (
    clave        TEXT NOT NULL,
    usuario_id   UUID NOT NULL REFERENCES usuario(id),
    endpoint     TEXT NOT NULL,
    status_code  INTEGER,
    respuesta    JSONB,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (clave, usuario_id)
);

CREATE INDEX ix_idempotencia_created ON idempotencia (created_at);

-- ============================================================================
-- 14. Tipos de cambio (migración 007 — dato de referencia global, inmutable)
-- REQUISITES §514–532: multimoneda; tasas históricas y reproducibles.
-- ============================================================================

CREATE TABLE tipo_cambio (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moneda_origen   TEXT NOT NULL,
    moneda_destino  TEXT NOT NULL,
    tasa            NUMERIC(18,8) NOT NULL CHECK (tasa > 0),
    fecha_vigencia  DATE NOT NULL,
    fuente          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_tipo_cambio_monedas CHECK (moneda_origen <> moneda_destino),
    UNIQUE (moneda_origen, moneda_destino, fecha_vigencia)
);

CREATE INDEX ix_tipo_cambio_par
    ON tipo_cambio (moneda_origen, moneda_destino, fecha_vigencia DESC);

-- ============================================================================
-- 15. Categorías de movimiento (migración 009 — configuración del hogar, G23)
-- Lista plana; se siembra un set inicial al crear el hogar.
-- ============================================================================

CREATE TABLE categoria_movimiento (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hogar_id        UUID NOT NULL REFERENCES hogar(id),
    nombre          TEXT NOT NULL,
    tipo_aplicable  TEXT NOT NULL CHECK (tipo_aplicable IN ('INGRESO', 'GASTO', 'AMBOS')),
    color           TEXT,
    icono           TEXT,
    orden           INTEGER NOT NULL DEFAULT 0,
    estado          TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'ARCHIVADA')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (hogar_id, nombre)
);

CREATE INDEX ix_categoria_movimiento_hogar
    ON categoria_movimiento (hogar_id, estado, orden);

-- ============================================================================
-- 16. Presupuesto por rubro (migración 010 — configuración, GAPS.md G26)
-- Monto esperado de una categoría de movimiento dentro de un presupuesto.
-- La proyección desviacion_presupuestaria se desglosa también por rubro.
-- ============================================================================

CREATE TABLE presupuesto_linea (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presupuesto_id UUID NOT NULL REFERENCES presupuesto(id) ON DELETE CASCADE,
    categoria_id   UUID NOT NULL REFERENCES categoria_movimiento(id),
    monto_esperado NUMERIC(18,2) NOT NULL CHECK (monto_esperado >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (presupuesto_id, categoria_id)
);

CREATE INDEX ix_presupuesto_linea_presu ON presupuesto_linea (presupuesto_id);

-- ============================================================================
-- 17. Plantillas de movimiento (migración 011 — configuración personal, G24)
-- Molde reutilizable y sin fecha para registrar gastos/ingresos recurrentes.
-- ============================================================================

CREATE TABLE plantilla_movimiento (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id          UUID NOT NULL REFERENCES usuario(id),
    nombre              TEXT NOT NULL,
    tipo                TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'GASTO', 'TRANSFERENCIA')),
    monto               NUMERIC(18,2) CHECK (monto IS NULL OR monto > 0),
    moneda              TEXT,
    elemento_origen_id  UUID REFERENCES elemento_patrimonial(id),
    elemento_destino_id UUID REFERENCES elemento_patrimonial(id),
    categoria_id        UUID REFERENCES categoria_movimiento(id),
    glosa               TEXT,
    orden               INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (usuario_id, nombre)
);

CREATE INDEX ix_plantilla_movimiento_usuario ON plantilla_movimiento (usuario_id, orden);

-- ============================================================================
-- 18. Etiquetas de movimiento (migración 012 — anotación personal, G23)
-- Clasificación transversal 0..N por movimiento. Complementa a la categoría.
-- ============================================================================

CREATE TABLE etiqueta (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuario(id),
    nombre     TEXT NOT NULL,
    color      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (usuario_id, nombre)
);

CREATE INDEX ix_etiqueta_usuario ON etiqueta (usuario_id);

CREATE TABLE evento_etiqueta (
    evento_id   UUID NOT NULL REFERENCES evento_financiero(id) ON DELETE CASCADE,
    etiqueta_id UUID NOT NULL REFERENCES etiqueta(id) ON DELETE CASCADE,

    PRIMARY KEY (evento_id, etiqueta_id)
);

CREATE INDEX ix_evento_etiqueta_etiqueta ON evento_etiqueta (etiqueta_id);

-- ============================================================================
-- Fin del esquema de dominio. Las proyecciones de lectura (patrimonio_individual,
-- patrimonio_familiar_consolidado, progreso_objetivo, desviacion_presupuestaria)
-- son vistas SQL o tablas materializadas — no forman parte de este DDL de dominio.
-- Se definen en un script separado según la decisión de performance
-- (vista en vivo vs. materializada) que aún no se ha tomado.
-- ============================================================================
