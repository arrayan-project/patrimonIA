-- ============================================================================
-- Migración 028 — Recurrencia de movimientos programados (G33, D-6 / HZ-16)
-- ============================================================================
-- Un programado puede repetirse cada mes o cada año, el mismo día, y lleva
-- categoría. No se materializa solo: al llegar la fecha se avisa "¿Se pagó?"
-- (notificación PROGRAMADO_VENCIDO) y, si nadie responde, queda PENDIENTE.
--
-- Una fila por ocurrencia (1 programado → 1 evento, como hasta ahora). Las
-- ocurrencias de una serie comparten `serie_id` (el id de la primera). Cuando
-- la última ocurrencia llega a su fecha se genera la siguiente, así la serie
-- siempre tiene una futura aunque las anteriores sigan sin respuesta.
--
--   periodicidad  MENSUAL / ANUAL; NULL = una sola vez (o "dejar de repetir").
--   dia           día del mes pedido (1–31). Se guarda aparte para que un 31
--                 que cae en un mes corto no se corra para siempre a 28.
--   avisado       ya se emitió el aviso "¿Se pagó?" de esta ocurrencia.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/028_movimiento_programado_recurrencia.sql
--   luego: npm run prisma:generate (el modelo se agrega a mano en schema.prisma)

ALTER TABLE movimiento_programado
    ADD COLUMN IF NOT EXISTS periodicidad TEXT,
    ADD COLUMN IF NOT EXISTS dia          SMALLINT,
    ADD COLUMN IF NOT EXISTS serie_id     UUID,
    ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categoria_movimiento(id),
    ADD COLUMN IF NOT EXISTS avisado      BOOLEAN NOT NULL DEFAULT false;

-- Filas existentes: cada una es su propia serie, de una sola vez. Las ya
-- resueltas no se avisan; las pendientes vencidas reciben su primer aviso.
UPDATE movimiento_programado SET serie_id = id WHERE serie_id IS NULL;
UPDATE movimiento_programado SET avisado = true WHERE estado <> 'PENDIENTE';

ALTER TABLE movimiento_programado
    ALTER COLUMN serie_id SET NOT NULL;

ALTER TABLE movimiento_programado
    ADD CONSTRAINT ck_mov_prog_periodicidad CHECK (periodicidad IN ('MENSUAL', 'ANUAL')),
    ADD CONSTRAINT ck_mov_prog_dia CHECK (dia BETWEEN 1 AND 31),
    ADD CONSTRAINT ck_mov_prog_recurrencia CHECK ((periodicidad IS NULL) = (dia IS NULL));

-- Una ocurrencia por fecha y serie: la generación es idempotente aunque corran
-- dos revisiones a la vez (cron y lectura).
CREATE UNIQUE INDEX IF NOT EXISTS ux_movimiento_programado_serie_fecha
    ON movimiento_programado (serie_id, fecha_programada);
