-- ============================================================================
-- 00 — Base de datos SOLO para los tests (patrimonia_test)
-- ============================================================================
-- Los e2e hacen TRUNCATE de casi todas las tablas en cada `beforeAll`. Para que
-- NUNCA toquen tus datos reales, corren contra esta base separada (ver
-- api/.env.test y api/vitest.config.e2e.ts). El esquema se le aplica en
-- 02_test_schema.sh (después de 01_schema.sql).
--
-- Este archivo lo ejecuta el entrypoint de Postgres solo en el primer arranque
-- del volumen (igual que 01_schema.sql).

CREATE DATABASE patrimonia_test;
