-- ============================================================================
-- Migración 007 — Tipos de cambio
-- ============================================================================
-- REQUISITES §514–532: la plataforma es multimoneda; los tipos de cambio deben
-- registrarse y conservarse históricamente, y una modificación posterior no debe
-- alterar reconstrucciones previas. Esta tabla es inmutable: cada tasa es una
-- fila nueva con su fecha de vigencia.
--
-- El comando RegistrarTipoCambio (nº 53, más allá del catálogo original de 52)
-- la puebla. Es dato de referencia global — no pertenece a ningún hogar.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/007_tipo_cambio.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS tipo_cambio (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    moneda_origen   TEXT NOT NULL,
    moneda_destino  TEXT NOT NULL,
    tasa            NUMERIC(18,8) NOT NULL CHECK (tasa > 0),
    fecha_vigencia  DATE NOT NULL,
    fuente          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_tipo_cambio_monedas CHECK (moneda_origen <> moneda_destino),
    UNIQUE (moneda_origen, moneda_destino, fecha_vigencia)
);

CREATE INDEX IF NOT EXISTS ix_tipo_cambio_par
    ON tipo_cambio (moneda_origen, moneda_destino, fecha_vigencia DESC);
