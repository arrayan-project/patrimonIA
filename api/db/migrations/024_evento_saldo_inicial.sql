-- ============================================================================
-- Migración 024 — Evento SALDO_INICIAL
-- ============================================================================
-- GAPS.md G29. Hasta ahora el saldo inicial de una cuenta (valorInicial al
-- registrar un elemento LIQUIDEZ/RESERVA) solo inicializaba `valor_vigente` — no
-- era un hecho económico, así que no aparecía en el flujo del período. El usuario
-- pidió que SÍ cuente como ingreso del mes en que se crea la cuenta.
--
-- Ahora `RegistrarElementoPatrimonial`, para LIQUIDEZ/RESERVA con valorInicial > 0,
-- crea también un evento_financiero de tipo SALDO_INICIAL + su impacto (+valorInicial)
-- con fecha = fecha_alta, en la misma transacción. El reporte lo suma a los
-- ingresos del período. No se puede crear a mano vía RegistrarEventoFinanciero
-- (no está en TIPOS_EVENTO) ni anular/corregir (usar un Ajuste Patrimonial).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/024_evento_saldo_inicial.sql
--   (no requiere prisma:pull — `tipo` sigue siendo TEXT)

ALTER TABLE evento_financiero DROP CONSTRAINT IF EXISTS evento_financiero_tipo_check;
ALTER TABLE evento_financiero ADD CONSTRAINT evento_financiero_tipo_check
    CHECK (tipo IN ('INGRESO', 'GASTO', 'TRANSFERENCIA', 'CONVERSION', 'PRESTAMO', 'SALDO_INICIAL'));
