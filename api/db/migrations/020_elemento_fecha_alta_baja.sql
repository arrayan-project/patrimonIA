-- ============================================================================
-- Migración 020 — fecha_alta / fecha_baja del elemento patrimonial
-- ============================================================================
-- GAPS.md P10 / G18 / B10. Decisión (usuario, 2026-09-05): "Sí" — el elemento
-- guarda cuándo entró y cuándo salió del patrimonio, para que la reconstrucción
-- histórica distinga "todavía no existía" y "ya no existía" en vez de usar el
-- estado ACTIVO/INACTIVO actual.
--
--   fecha_alta  NOT NULL  — por defecto la fecha de registro; editable en el alta.
--   fecha_baja  NULL      — se fija al Desactivar; Reactivar la vuelve a NULL.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/020_elemento_fecha_alta_baja.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

ALTER TABLE elemento_patrimonial
    ADD COLUMN IF NOT EXISTS fecha_alta DATE,
    ADD COLUMN IF NOT EXISTS fecha_baja DATE;

-- Backfill: alta = fecha de creación; baja = fecha de creación si hoy está INACTIVO
-- (no hay mejor dato retroactivo — ver GAPS.md).
UPDATE elemento_patrimonial SET fecha_alta = created_at::date WHERE fecha_alta IS NULL;
UPDATE elemento_patrimonial SET fecha_baja = created_at::date
    WHERE fecha_baja IS NULL AND estado = 'INACTIVO';

ALTER TABLE elemento_patrimonial ALTER COLUMN fecha_alta SET NOT NULL;
