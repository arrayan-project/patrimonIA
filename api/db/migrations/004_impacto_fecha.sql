-- ============================================================================
-- Migración 004 — fecha denormalizada en impacto_patrimonial
-- ============================================================================
-- La reconstrucción histórica (DDD Sección V) responde "¿cuál era el valor de
-- esta entidad en el pasado?" aplicando en orden los hechos económicos con
-- fecha <= X. `impacto_patrimonial` no tenía fecha propia (había que joinear
-- con evento_financiero / valorizacion / ajuste_patrimonial). Se denormaliza,
-- igual que `elemento_patrimonial.valor_vigente` — inmutable tras creación.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/004_impacto_fecha.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

ALTER TABLE impacto_patrimonial ADD COLUMN IF NOT EXISTS fecha DATE;

UPDATE impacto_patrimonial i SET fecha = e.fecha
  FROM evento_financiero e
  WHERE i.origen_tipo = 'EVENTO_FINANCIERO' AND i.origen_id = e.id AND i.fecha IS NULL;

UPDATE impacto_patrimonial i SET fecha = v.fecha
  FROM valorizacion v
  WHERE i.origen_tipo = 'VALORIZACION' AND i.origen_id = v.id AND i.fecha IS NULL;

UPDATE impacto_patrimonial i SET fecha = a.fecha
  FROM ajuste_patrimonial a
  WHERE i.origen_tipo = 'AJUSTE_PATRIMONIAL' AND i.origen_id = a.id AND i.fecha IS NULL;

UPDATE impacto_patrimonial i SET fecha = (au.fecha_hora AT TIME ZONE 'UTC')::date
  FROM auditoria au
  WHERE i.origen_tipo IN ('CONDONACION', 'DECLARACION_INCOBRABLE')
    AND i.origen_id = au.id AND i.fecha IS NULL;

-- Cualquier fila sin resolver: cae al día de creación del impacto.
UPDATE impacto_patrimonial SET fecha = created_at::date WHERE fecha IS NULL;

ALTER TABLE impacto_patrimonial ALTER COLUMN fecha SET NOT NULL;
CREATE INDEX IF NOT EXISTS ix_impacto_fecha ON impacto_patrimonial (fecha);
