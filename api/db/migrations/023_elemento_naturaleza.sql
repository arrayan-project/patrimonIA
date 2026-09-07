-- ============================================================================
-- Migración 023 — Naturaleza de Deuda / Crédito (dinero en custodia informal)
-- ============================================================================
-- GAPS.md G28 / DOMINIO_PENDIENTE.md §B-custodia. Distinción de dominio, no de
-- presentación: una Deuda/Crédito puede ser FINANCIERA (un crédito real, un
-- préstamo entre personas) o CUSTODIA_INFORMAL (plata que solo pasa por mis
-- cuentas — un amigo me transfiere para que le compre algo). El neto patrimonial
-- es el mismo; lo que cambia es cómo se agrupa y se explica en la app.
--
-- `naturaleza` es un atributo del comando RegistrarElementoPatrimonial cuando la
-- categoría es DEUDA/CREDITO — mismo patrón que CondonarDeuda vs DeclararIncobrable
-- (la distinción vive en el modelo, no en un flag de UI). Ver DDD.docx §T y la
-- adenda Docs/DDD-adenda-naturaleza.md.
--
-- NOT NULL para DEUDA/CREDITO (default 'FINANCIERA' en el backfill y en el service),
-- NULL en el resto de categorías.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/023_elemento_naturaleza.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

ALTER TABLE elemento_patrimonial ADD COLUMN IF NOT EXISTS naturaleza TEXT;

-- Backfill: toda deuda/crédito existente es FINANCIERA (comportamiento previo).
UPDATE elemento_patrimonial
   SET naturaleza = 'FINANCIERA'
 WHERE categoria_funcional IN ('DEUDA', 'CREDITO')
   AND naturaleza IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_naturaleza_valores') THEN
    ALTER TABLE elemento_patrimonial
      ADD CONSTRAINT ck_naturaleza_valores
      CHECK (naturaleza IS NULL OR naturaleza IN ('FINANCIERA', 'CUSTODIA_INFORMAL'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_naturaleza_categoria') THEN
    ALTER TABLE elemento_patrimonial
      ADD CONSTRAINT ck_naturaleza_categoria CHECK (
        (categoria_funcional IN ('DEUDA', 'CREDITO') AND naturaleza IS NOT NULL)
        OR (categoria_funcional NOT IN ('DEUDA', 'CREDITO') AND naturaleza IS NULL)
      );
  END IF;
END $$;
