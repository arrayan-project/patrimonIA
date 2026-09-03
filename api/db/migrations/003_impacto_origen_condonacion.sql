-- ============================================================================
-- Migración 003 — orígenes de impacto para Deuda/Crédito
-- ============================================================================
-- CondonarDeuda (AS #47) y DeclararIncobrable (AS #48) generan un impacto
-- patrimonial que lleva el valor pendiente a cero, pero su origen no es un
-- Evento Financiero ni una Valorización ni un Ajuste. Se amplía el CHECK de
-- `impacto_patrimonial.origen_tipo` con dos valores nuevos; el `origen_id`
-- apunta a la entrada de auditoría del comando (no hay tabla propia — Deuda/
-- Crédito es una especialización de elemento_patrimonial, DDD Sección T).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/003_impacto_origen_condonacion.sql

ALTER TABLE impacto_patrimonial
    DROP CONSTRAINT IF EXISTS impacto_patrimonial_origen_tipo_check;
ALTER TABLE impacto_patrimonial
    ADD CONSTRAINT impacto_patrimonial_origen_tipo_check CHECK (origen_tipo IN (
        'EVENTO_FINANCIERO',
        'VALORIZACION',
        'AJUSTE_PATRIMONIAL',
        'CONDONACION',
        'DECLARACION_INCOBRABLE'
    ));
