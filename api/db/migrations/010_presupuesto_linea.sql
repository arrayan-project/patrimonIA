-- ============================================================================
-- Migración 010 — Presupuesto por rubro (línea de presupuesto)
-- ============================================================================
-- UI_UX_BACKLOG C3 / GAPS.md G26. Cada línea fija el monto esperado de una
-- categoría de movimiento dentro de un presupuesto. La proyección
-- `desviacion_presupuestaria` pasa a desglosarse también por rubro.
--
-- Es configuración, no hecho económico → su historial vive solo en `auditoria`
-- (DATABASE_DESIGN §125, Principio C). No participa de la reconstrucción
-- histórica (Sección V).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/010_presupuesto_linea.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS presupuesto_linea (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presupuesto_id UUID NOT NULL REFERENCES presupuesto(id) ON DELETE CASCADE,
    categoria_id   UUID NOT NULL REFERENCES categoria_movimiento(id),
    monto_esperado NUMERIC(18,2) NOT NULL CHECK (monto_esperado >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (presupuesto_id, categoria_id)
);

CREATE INDEX IF NOT EXISTS ix_presupuesto_linea_presu
    ON presupuesto_linea (presupuesto_id);
