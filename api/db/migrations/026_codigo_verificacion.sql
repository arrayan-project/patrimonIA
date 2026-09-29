-- ============================================================================
-- Migración 026 — codigo_verificacion (códigos de 6 dígitos por email)
-- ============================================================================
-- GAPS.md G31 (mejora de UX) y G4. El reset de contraseña y el registro
-- enviaban un JWT completo (~250 caracteres) para copiar y pegar; ahora envían
-- un código de 6 dígitos. Se guarda solo su hash (HMAC con JWT_SECRET), vence
-- a los 15 min y admite 5 intentos: con 10^6 combinaciones, adivinarlo por
-- fuerza bruta no es viable. Tabla aparte (no columnas en `usuario`) porque el
-- código de registro se emite antes de que exista el usuario.
--
-- Pedir un código nuevo reemplaza el anterior (PK = email + propósito).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/026_codigo_verificacion.sql
--   luego: npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS codigo_verificacion (
    email        TEXT        NOT NULL,
    proposito    TEXT        NOT NULL CONSTRAINT ck_codigo_verificacion_proposito
                                 CHECK (proposito IN ('REGISTRO', 'RESET')),
    codigo_hash  TEXT        NOT NULL,
    expira_en    TIMESTAMPTZ NOT NULL,
    intentos     INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (email, proposito)
);
