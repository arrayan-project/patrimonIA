-- ============================================================================
-- Migración 011 — Plantillas de movimiento
-- ============================================================================
-- UI_UX_BACKLOG C4 / GAPS.md G24. Molde reutilizable y SIN fecha para registrar
-- "el gasto de siempre" en dos toques. Distinto de Movimiento Programado
-- (#13–#16), que es un movimiento futuro concreto con fecha.
--
-- Es configuración PERSONAL (un usuario), no hecho económico → su historial vive
-- solo en `auditoria` (DATABASE_DESIGN §125, Principio C). No participa de la
-- reconstrucción histórica (Sección V). Los eventos que se generan a partir de
-- una plantilla son independientes de ella.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/011_plantilla_movimiento.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS plantilla_movimiento (
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

CREATE INDEX IF NOT EXISTS ix_plantilla_movimiento_usuario
    ON plantilla_movimiento (usuario_id, orden);
