-- ============================================================================
-- Migración 001 — propietario de Objetivo Financiero y Asignación
-- ============================================================================
-- Vacío del diseño (GAPS.md G13): DDD Secciones H y J no definen quién es dueño
-- de un objetivo o una asignación, y el esquema no tiene columna de propiedad.
-- Decisión: son PERSONALES (del usuario que los crea), consistente con el
-- planteamiento monousuario del Flujo 5 (UX_FLOWS). Objetivos/asignaciones
-- compartidos por hogar quedan como pregunta abierta.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/001_objetivo_asignacion_propietario.sql
-- (Las DB nuevas ya lo traen en init/01_schema.sql.)

ALTER TABLE objetivo_financiero
    ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuario(id);

ALTER TABLE asignacion
    ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuario(id);

CREATE INDEX IF NOT EXISTS ix_objetivo_usuario ON objetivo_financiero (usuario_id);
CREATE INDEX IF NOT EXISTS ix_asignacion_usuario ON asignacion (usuario_id);

-- Filas preexistentes (si las hubiera) quedan con usuario_id NULL — huérfanas,
-- solo visibles vía auditoría. En este punto del proyecto no hay datos reales.
