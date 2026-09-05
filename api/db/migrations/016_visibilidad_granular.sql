-- ============================================================================
-- Migración 016 — Visibilidad granular del Elemento Patrimonial
-- ============================================================================
-- DOMINIO_PENDIENTE.md §B1 / GAPS.md G6 / REQUISITES §M. Hasta ahora había un
-- único enum `visibilidad` y COMPARTIDA se comportaba igual que FAMILIAR.
--
-- Ahora:
--   * `elemento_visibilidad` — nivel por TIPO de información (EXISTENCIA / VALOR /
--     MOVIMIENTOS). Una fila solo existe si sobrescribe el nivel base
--     (`elemento_patrimonial.visibilidad`); su ausencia = usar el nivel base.
--   * `elemento_comparticion` — con QUÉ personas se comparte cuando el nivel es
--     COMPARTIDA (FAMILIAR = todos los co-miembros; PRIVADA = nadie).
--
-- El enum base `visibilidad` se conserva como nivel por defecto de todos los
-- tipos. Nada cambia para los elementos existentes (sin filas nuevas).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/016_visibilidad_granular.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS elemento_visibilidad (
    elemento_id UUID NOT NULL REFERENCES elemento_patrimonial(id) ON DELETE CASCADE,
    tipo_info   TEXT NOT NULL CHECK (tipo_info IN ('EXISTENCIA', 'VALOR', 'MOVIMIENTOS')),
    nivel       TEXT NOT NULL CHECK (nivel IN ('PRIVADA', 'COMPARTIDA', 'FAMILIAR')),
    PRIMARY KEY (elemento_id, tipo_info)
);

CREATE TABLE IF NOT EXISTS elemento_comparticion (
    elemento_id UUID NOT NULL REFERENCES elemento_patrimonial(id) ON DELETE CASCADE,
    usuario_id  UUID NOT NULL REFERENCES usuario(id),
    PRIMARY KEY (elemento_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS ix_elemento_comparticion_usuario
    ON elemento_comparticion (usuario_id);
