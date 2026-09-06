-- ============================================================================
-- Migración 019 — Línea de ahorro esperado por objetivo en el presupuesto
-- ============================================================================
-- GAPS.md P6 / G15 / G26 / B7. Decisión (usuario, 2026-09-05): "Sí" — el
-- presupuesto puede fijar cuánto se espera ahorrar hacia cada objetivo en el
-- período, análogo a `presupuesto_linea` (gasto por rubro). Tabla aparte para
-- no tocar `presupuesto_linea`.
--
-- El "real" de una línea de ahorro = Σ reserva.monto (estado != LIBERADA) de las
-- asignaciones del objetivo, creadas dentro del período del presupuesto.
--
-- Configuración, no hecho económico → historial solo en `auditoria`.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/019_presupuesto_linea_ahorro.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS presupuesto_linea_ahorro (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presupuesto_id UUID NOT NULL REFERENCES presupuesto(id) ON DELETE CASCADE,
    objetivo_id    UUID NOT NULL REFERENCES objetivo_financiero(id),
    monto_esperado NUMERIC(18,2) NOT NULL CHECK (monto_esperado >= 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (presupuesto_id, objetivo_id)
);

CREATE INDEX IF NOT EXISTS ix_presupuesto_linea_ahorro_presu
    ON presupuesto_linea_ahorro (presupuesto_id);
