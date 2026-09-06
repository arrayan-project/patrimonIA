-- ============================================================================
-- Migración 022 — Moneda propia en objetivo / asignación / presupuesto (P11)
-- ============================================================================
-- Decisión (usuario, 2026-09-05): "Debería, pero solo afecta a ese elemento, no
-- ramificarse". La moneda es una ETIQUETA para mostrar y formatear montos — NO
-- hay conversión ni validación cruzada (una reserva en CLP puede aportar a un
-- objetivo etiquetado en USD; el progreso suma los montos crudos, como el resto
-- de las proyecciones sin tipo de cambio — GAPS.md G7/G16).
--
-- La reserva NO lleva moneda propia: es la del elemento origen.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/022_moneda_planificacion.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

ALTER TABLE objetivo_financiero ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'CLP';
ALTER TABLE asignacion          ADD COLUMN IF NOT EXISTS moneda TEXT;
ALTER TABLE presupuesto         ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'CLP';
