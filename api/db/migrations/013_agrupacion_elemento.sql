-- ============================================================================
-- Migración 013 — Agrupaciones de elementos patrimoniales
-- ============================================================================
-- UI_UX_BACKLOG C6 / GAPS.md G23. Carpeta de VISUALIZACIÓN, personal, para
-- ordenar tus cuentas y activos ("Inversiones" agrupando Fintual / APV / Fondo
-- Mutuo — REQUISITES §D). Un elemento pertenece a lo sumo a una agrupación
-- (metáfora de carpeta): `elemento_id` es único en `agrupacion_miembro`.
--
-- NO se confunde con Asignación (Agregado H), que reserva VALOR con un propósito
-- ("Vacaciones", "Matrícula") y ya existe. La agrupación no mueve ni reserva
-- nada — solo organiza la vista.
--
-- Es configuración → historial solo en `auditoria` (DATABASE_DESIGN §125). No
-- participa de la reconstrucción histórica (Sección V) ni de la consolidación.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/013_agrupacion_elemento.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS agrupacion_elemento (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES usuario(id),
    nombre     TEXT NOT NULL,
    color      TEXT,
    orden      INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (usuario_id, nombre)
);

CREATE INDEX IF NOT EXISTS ix_agrupacion_elemento_usuario
    ON agrupacion_elemento (usuario_id, orden);

CREATE TABLE IF NOT EXISTS agrupacion_miembro (
    elemento_id   UUID PRIMARY KEY REFERENCES elemento_patrimonial(id) ON DELETE CASCADE,
    agrupacion_id UUID NOT NULL REFERENCES agrupacion_elemento(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_agrupacion_miembro_agrupacion
    ON agrupacion_miembro (agrupacion_id);
