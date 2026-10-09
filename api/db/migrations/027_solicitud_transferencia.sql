-- ============================================================================
-- Migración 027 — solicitud_transferencia (G33 bloque 9: D-7 + HZ-21)
-- ============================================================================
-- Un miembro del hogar le pide a otro que anote una TRANSFERENCIA hacia una
-- cuenta suya:
--   - GASTO_COMPARTIDO (D-7, M7): pagó algo de los dos y pide la parte del otro.
--   - SIN_ANOTAR (Recibí → De alguien del hogar, "Avisarle a [miembro]"): la
--     plata ya le llegó, pero quien la envió no la anotó.
-- Tabla de apoyo, como `notificacion` (Principio 4): no es un agregado del
-- dominio, no mueve saldos ni genera auditoría. El gasto y la transferencia son
-- eventos normales (RegistrarEventoFinanciero). La notificación es solo el
-- aviso: si el usuario silencia ese tipo (G20), la solicitud sigue aquí.
--
-- El estado no se guarda: se deriva al leer. Pago vigente → PAGADA; gasto
-- anulado → ANULADA; `rechazada` → RECHAZADA; si no, PENDIENTE. Si se anula la
-- transferencia que la pagó, vuelve sola a PENDIENTE.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/027_solicitud_transferencia.sql
--   luego: npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS solicitud_transferencia (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    motivo               TEXT          NOT NULL CONSTRAINT ck_solicitud_motivo
                                           CHECK (motivo IN ('GASTO_COMPARTIDO', 'SIN_ANOTAR')),
    hogar_id             UUID          NOT NULL REFERENCES hogar(id),
    solicitante_id       UUID          NOT NULL REFERENCES usuario(id),
    destinatario_id      UUID          NOT NULL REFERENCES usuario(id),
    monto                NUMERIC(18,2) NOT NULL CONSTRAINT ck_solicitud_monto CHECK (monto > 0),
    moneda               TEXT          NOT NULL,
    elemento_destino_id  UUID          NOT NULL REFERENCES elemento_patrimonial(id),
    evento_gasto_id      UUID          REFERENCES evento_financiero(id),
    evento_pago_id       UUID          REFERENCES evento_financiero(id),
    fecha                DATE          NOT NULL,
    glosa                TEXT,
    rechazada            BOOLEAN       NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_solicitud_partes CHECK (solicitante_id <> destinatario_id),
    CONSTRAINT ck_solicitud_gasto CHECK ((motivo = 'GASTO_COMPARTIDO') = (evento_gasto_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ix_solicitud_solicitante ON solicitud_transferencia (solicitante_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_solicitud_destinatario ON solicitud_transferencia (destinatario_id, created_at DESC);
