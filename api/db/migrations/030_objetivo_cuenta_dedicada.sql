-- ============================================================================
-- Migración 030 — Cuentas dedicadas a una meta (Bloque M)
-- ============================================================================
-- Ver Docs/usabilidad/METAS_CUENTAS_S04.md. Una meta puede tener varias cuentas
-- "🏦 Esta cuenta es para esta meta": su progreso = apartados fijos (reservas)
-- + valor actual de sus cuentas dedicadas. Es una decisión sobre la meta
-- (agregado Objetivo), por eso tabla propia y no columna en la cuenta.
--
--   UNIQUE (elemento_id)  una cuenta se dedica a una sola meta (M-3).
--   ON DELETE CASCADE     al eliminar la meta, la cuenta queda libre.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/030_objetivo_cuenta_dedicada.sql
--   (y en patrimonia_test y Neon); luego: npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS objetivo_cuenta_dedicada (
    objetivo_id UUID NOT NULL REFERENCES objetivo_financiero(id) ON DELETE CASCADE,
    elemento_id UUID NOT NULL REFERENCES elemento_patrimonial(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (objetivo_id, elemento_id),
    CONSTRAINT uq_objetivo_cuenta_dedicada_elemento UNIQUE (elemento_id)
);
