-- ============================================================================
-- Migración 015 — Tipo en Movimiento Programado (INGRESO / GASTO / TRANSFERENCIA)
-- ============================================================================
-- DOMINIO_PENDIENTE.md §B5 / GAPS.md G2. Hasta ahora el movimiento programado
-- solo modelaba un INGRESO hacia un elemento destino. Ahora puede programarse
-- también un GASTO (desde un elemento origen) o una TRANSFERENCIA (origen →
-- destino). La visibilidad/propiedad sigue heredada de los elementos referidos
-- (DDD §S — no se agregan columnas propias).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/015_movimiento_programado_tipo.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

ALTER TABLE movimiento_programado
    ADD COLUMN IF NOT EXISTS tipo              TEXT,
    ADD COLUMN IF NOT EXISTS elemento_origen_id UUID REFERENCES elemento_patrimonial(id);

-- Filas existentes: todas eran INGRESO hacia el destino.
UPDATE movimiento_programado SET tipo = 'INGRESO' WHERE tipo IS NULL;

ALTER TABLE movimiento_programado
    ALTER COLUMN tipo SET NOT NULL,
    ALTER COLUMN elemento_destino_id DROP NOT NULL;

ALTER TABLE movimiento_programado
    ADD CONSTRAINT ck_mov_prog_tipo CHECK (tipo IN ('INGRESO', 'GASTO', 'TRANSFERENCIA')),
    ADD CONSTRAINT ck_mov_prog_elementos CHECK (
        (tipo = 'INGRESO'       AND elemento_destino_id IS NOT NULL AND elemento_origen_id IS NULL)
     OR (tipo = 'GASTO'         AND elemento_origen_id  IS NOT NULL AND elemento_destino_id IS NULL)
     OR (tipo = 'TRANSFERENCIA' AND elemento_origen_id  IS NOT NULL AND elemento_destino_id IS NOT NULL)
    );

CREATE INDEX IF NOT EXISTS ix_movimiento_programado_origen
    ON movimiento_programado (elemento_origen_id) WHERE elemento_origen_id IS NOT NULL;
