-- ============================================================================
-- Migración 017 — Categorías de movimiento jerárquicas (GAPS.md P7 / B9)
-- ============================================================================
-- Decisión (usuario, 2026-09-05): las categorías del hogar pueden anidarse en
-- 2 niveles ("Servicios › Internet"). El usuario puede crear tanto categorías
-- raíz como subcategorías. Se mantiene todo lo demás: del hogar, opcional en el
-- evento, configuración (historial solo en auditoría).
--
-- `categoria_padre_id` NULL  → categoría raíz.
-- `categoria_padre_id` != NULL → subcategoría; el padre debe ser raíz (2 niveles,
--   se valida en la capa de servicio — Postgres no restringe la profundidad).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/017_categoria_jerarquica.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

ALTER TABLE categoria_movimiento
    ADD COLUMN IF NOT EXISTS categoria_padre_id UUID REFERENCES categoria_movimiento(id);

CREATE INDEX IF NOT EXISTS ix_categoria_movimiento_padre
    ON categoria_movimiento (categoria_padre_id) WHERE categoria_padre_id IS NOT NULL;

-- OJO (prisma db pull): al auto-relacionar categoria_movimiento consigo misma,
-- la introspección ELIMINA la relación evento_financiero ⇄ categoria_movimiento
-- (deja categoria_id como escalar suelto). Tras cada `npm run prisma:pull` hay
-- que volver a agregarla a mano en schema.prisma con un nombre de relación
-- explícito:
--   model evento_financiero {
--     categoria_movimiento categoria_movimiento? @relation("evento_financiero_categoria", fields: [categoria_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
--   }
--   model categoria_movimiento {
--     evento_financiero evento_financiero[] @relation("evento_financiero_categoria")
--   }
