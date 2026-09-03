-- ============================================================================
-- Migración 006 — Idempotencia de comandos
-- ============================================================================
-- API_DESIGN §43: los comandos de creación aceptan un header opcional
-- `Idempotency-Key` para evitar duplicados por reintento de red. "No está en el
-- DDD, es una decisión estándar de API". Esta tabla guarda la respuesta ya
-- emitida para una (clave, usuario). Infraestructura, no dominio.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/006_idempotencia.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS idempotencia (
    clave        TEXT NOT NULL,
    usuario_id   UUID NOT NULL REFERENCES usuario(id),
    endpoint     TEXT NOT NULL,
    status_code  INTEGER,          -- NULL mientras el comando está en curso
    respuesta    JSONB,            -- NULL mientras el comando está en curso
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (clave, usuario_id)
);

CREATE INDEX IF NOT EXISTS ix_idempotencia_created ON idempotencia (created_at);
