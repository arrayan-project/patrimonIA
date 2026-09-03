-- ============================================================================
-- Migración 008 — Dispositivos para notificaciones push
-- ============================================================================
-- El Principio 4 pide "notificar al usuario". La tabla `notificacion` (migr. 005)
-- ya guarda el aviso in-app; esta tabla guarda los Expo push tokens de los
-- dispositivos del usuario para el envío real. Infraestructura, no dominio.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/008_dispositivo_push.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS dispositivo_push (
    usuario_id       UUID NOT NULL REFERENCES usuario(id),
    expo_push_token  TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS ix_dispositivo_push_usuario ON dispositivo_push (usuario_id);
