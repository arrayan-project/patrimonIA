-- ============================================================================
-- Migración 009 — Categorías de movimiento + glosa del evento financiero
-- ============================================================================
-- GAPS.md G22 (glosa) y G23 (categorización de movimientos). Decisiones:
--   - categorías DEL HOGAR (vocabulario compartido)
--   - lista PLANA (sin jerarquía por ahora)
--   - categoría siempre OPCIONAL en el evento
--   - glosa: texto libre corto, opcional
-- Todo esto es configuración/anotación, no hecho económico → su historial vive
-- solo en `auditoria` (DATABASE_DESIGN §125). No participa de la reconstrucción
-- histórica (Sección V).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/009_categoria_movimiento.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS categoria_movimiento (
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

CREATE INDEX IF NOT EXISTS ix_categoria_movimiento_hogar
    ON categoria_movimiento (hogar_id, estado, orden);

ALTER TABLE evento_financiero
    ADD COLUMN IF NOT EXISTS glosa        TEXT,
    ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categoria_movimiento(id);

CREATE INDEX IF NOT EXISTS ix_evento_categoria
    ON evento_financiero (categoria_id) WHERE categoria_id IS NOT NULL;
