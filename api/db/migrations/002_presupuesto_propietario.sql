-- ============================================================================
-- Migración 002 — propietario de Presupuesto
-- ============================================================================
-- Vacío del diseño (GAPS.md G15): el esquema de `presupuesto` no tiene columna
-- de propiedad, pero AS #49 (CrearPresupuesto) audita "usuario/hogar" y el tipo
-- INDIVIDUAL/FAMILIAR implica un dueño distinto en cada caso.
--
-- Decisión (misma línea que la migración 001 para objetivo/asignación):
--   INDIVIDUAL → usuario_id = creador,  hogar_id = NULL
--   FAMILIAR   → usuario_id = creador,  hogar_id = hogar al que pertenece
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/002_presupuesto_propietario.sql
-- (Las DB nuevas ya lo traen en init/01_schema.sql.)

ALTER TABLE presupuesto
    ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuario(id),
    ADD COLUMN IF NOT EXISTS hogar_id   UUID REFERENCES hogar(id);

ALTER TABLE presupuesto
    DROP CONSTRAINT IF EXISTS ck_presupuesto_propietario;
ALTER TABLE presupuesto
    ADD CONSTRAINT ck_presupuesto_propietario CHECK (
        (tipo = 'FAMILIAR'   AND hogar_id IS NOT NULL)
        OR (tipo = 'INDIVIDUAL' AND hogar_id IS NULL)
    );

CREATE INDEX IF NOT EXISTS ix_presupuesto_usuario ON presupuesto (usuario_id);
CREATE INDEX IF NOT EXISTS ix_presupuesto_hogar   ON presupuesto (hogar_id);

-- Filas preexistentes (si las hubiera) quedan con usuario_id NULL — huérfanas,
-- solo visibles vía auditoría. En este punto del proyecto no hay datos reales.
