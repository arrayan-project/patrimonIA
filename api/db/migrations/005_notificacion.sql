-- ============================================================================
-- Migración 005 — Notificaciones
-- ============================================================================
-- El Principio 4 del DDD dice que cuando una política del dominio infiere un
-- cambio (completar objetivo, consumir reserva) "se notifica al usuario como
-- consecuencia". Hasta ahora eso solo quedaba en `auditoria`. Esta tabla es el
-- registro in-app de esas notificaciones. NO es una entidad del dominio (no
-- genera auditoría, se puede regenerar) — es infraestructura de presentación.
-- El envío real (push / email) queda fuera de alcance (UX_FLOWS).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/005_notificacion.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS notificacion (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id     UUID NOT NULL REFERENCES usuario(id),
    tipo           TEXT NOT NULL,   -- OBJETIVO_COMPLETADO, RESERVA_CONSUMIDA, INVITACION_RECIBIDA, ...
    titulo         TEXT NOT NULL,
    cuerpo         TEXT NOT NULL,
    entidad_tipo   TEXT,
    entidad_id     UUID,
    leida          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_notificacion_usuario ON notificacion (usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_notificacion_no_leida ON notificacion (usuario_id) WHERE leida = FALSE;
