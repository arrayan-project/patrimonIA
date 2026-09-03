-- ============================================================================
-- Migración 012 — Etiquetas de movimiento
-- ============================================================================
-- UI_UX_BACKLOG C5 / GAPS.md G23. Etiqueta = clasificación transversal y
-- acumulativa (0..N por movimiento), PERSONAL (vocabulario de cada usuario),
-- plana. Complementa a la categoría (0..1, del hogar, columna vertebral del
-- presupuesto). No entra en el presupuesto (un gasto con 3 etiquetas ¿a qué
-- rubro imputa?).
--
-- Es anotación, no hecho económico → historial solo en `auditoria`
-- (DATABASE_DESIGN §125, Principio C). No participa de la reconstrucción
-- histórica (Sección V): se pueden re-etiquetar movimientos viejos sin anular.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/012_etiqueta.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS etiqueta (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuario(id),
    nombre     TEXT NOT NULL,
    color      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (usuario_id, nombre)
);

CREATE INDEX IF NOT EXISTS ix_etiqueta_usuario ON etiqueta (usuario_id);

CREATE TABLE IF NOT EXISTS evento_etiqueta (
    evento_id   UUID NOT NULL REFERENCES evento_financiero(id) ON DELETE CASCADE,
    etiqueta_id UUID NOT NULL REFERENCES etiqueta(id) ON DELETE CASCADE,

    PRIMARY KEY (evento_id, etiqueta_id)
);

CREATE INDEX IF NOT EXISTS ix_evento_etiqueta_etiqueta ON evento_etiqueta (etiqueta_id);
