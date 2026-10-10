-- ============================================================================
-- Migración 029 — Día en que parte el mes del hogar (G43)
-- ============================================================================
-- Mucha gente vive el mes desde que le llega el sueldo (p. ej. del 25 al 24),
-- no del 1 al último día. Cada persona elige su día en sus preferencias
-- (`usuario.preferencias.visualizacion.mes`, JSONB, sin migración); el hogar
-- tiene el suyo para sus vistas compartidas (Movimientos del hogar), así los
-- dos miembros ven el mismo número para lo mismo.
--
--   dia_inicio_mes  1–28 (hasta 28 para que exista en todo mes). 1 = el mes
--                   calendario, como hasta ahora.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/029_hogar_dia_inicio_mes.sql
--   (y en patrimonia_test y Neon); luego: npm run prisma:generate

ALTER TABLE hogar
    ADD COLUMN IF NOT EXISTS dia_inicio_mes SMALLINT NOT NULL DEFAULT 1
        CHECK (dia_inicio_mes BETWEEN 1 AND 28);
