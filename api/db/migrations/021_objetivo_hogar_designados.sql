-- ============================================================================
-- Migración 021 — Objetivos financieros compartidos por hogar (GAPS.md P9 / B6)
-- ============================================================================
-- Decisión (usuario, 2026-09-05): un objetivo puede seleccionarse para formar
-- parte de una vista de hogar. Todos los miembros lo VEN; solo los "designados"
-- (y el dueño) lo MODIFICAN. El ADMINISTRADOR del hogar asigna los designados.
--
--   objetivo_financiero.hogar_id  NULL  → objetivo personal (como hasta ahora).
--                                 !NULL → compartido con ese hogar.
--   objetivo_designado(objetivo_id, usuario_id) → quién puede modificarlo.
--
-- Las asignaciones y reservas de un objetivo compartido heredan su alcance: los
-- modificadores del objetivo pueden crear/editar asignaciones y reservar SU
-- propio dinero hacia él. Las asignaciones sueltas (sin objetivo) siguen siendo
-- personales.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/021_objetivo_hogar_designados.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

ALTER TABLE objetivo_financiero
    ADD COLUMN IF NOT EXISTS hogar_id UUID REFERENCES hogar(id);

CREATE INDEX IF NOT EXISTS ix_objetivo_hogar
    ON objetivo_financiero (hogar_id) WHERE hogar_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS objetivo_designado (
    objetivo_id UUID NOT NULL REFERENCES objetivo_financiero(id) ON DELETE CASCADE,
    usuario_id  UUID NOT NULL REFERENCES usuario(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (objetivo_id, usuario_id)
);
