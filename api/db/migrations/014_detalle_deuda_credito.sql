-- ============================================================================
-- Migración 014 — Información adicional de Deuda / Crédito
-- ============================================================================
-- DOMINIO_PENDIENTE.md §B3 (REQUISITES §J). Campos OPCIONALES que solo aplican a
-- categoría DEUDA / CREDITO; NULL en el resto. No cambian el patrimonio — son
-- metadatos para que la app sea útil con créditos reales (hipotecario, préstamo
-- a un amigo).
--
-- `valor_pendiente_inicial` (§B2): saldo pendiente al registrar el elemento, para
-- derivar el estado operativo ("parcialmente pagada" = pendiente < inicial).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/014_detalle_deuda_credito.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

ALTER TABLE elemento_patrimonial
    ADD COLUMN IF NOT EXISTS contraparte             TEXT,
    ADD COLUMN IF NOT EXISTS fecha_inicio            DATE,
    ADD COLUMN IF NOT EXISTS fecha_termino           DATE,
    ADD COLUMN IF NOT EXISTS cuota_monto             NUMERIC(18,2),
    ADD COLUMN IF NOT EXISTS tasa_interes            NUMERIC(9,4),
    ADD COLUMN IF NOT EXISTS observaciones           TEXT,
    ADD COLUMN IF NOT EXISTS valor_pendiente_inicial NUMERIC(18,2);

-- Backfill: para las deudas/créditos ya existentes, asumir que aún no se ha
-- pagado nada (inicial = pendiente actual).
UPDATE elemento_patrimonial
   SET valor_pendiente_inicial = valor_pendiente
 WHERE categoria_funcional IN ('DEUDA', 'CREDITO')
   AND valor_pendiente_inicial IS NULL
   AND valor_pendiente IS NOT NULL;
