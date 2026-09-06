-- ============================================================================
-- Migración 018 — Catálogo de tipos de elemento patrimonial (por hogar)
-- ============================================================================
-- Decisión (usuario, 2026-09-05): los tipos de elemento (cuenta corriente,
-- cuenta vista, APV, propiedad…) hoy son texto libre / lista fija en la app.
-- Pasan a ser un catálogo editable DEL HOGAR, igual que `categoria_movimiento`:
-- se siembra un set inicial al crear el hogar y el usuario puede crear más.
--
-- `elemento_patrimonial.tipo` sigue siendo TEXT libre (compat con lo ya
-- registrado y con elementos de propietarios en varios hogares) — el catálogo
-- es VOCABULARIO sugerido: al elegir un tipo se copia su `nombre` a
-- `elemento_patrimonial.tipo` y, si tiene, se prellenar la categoría funcional.
--
-- Configuración, no hecho económico → historial solo en `auditoria`.
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/018_tipo_elemento.sql
--   cd api && npm run prisma:pull && npm run prisma:generate

CREATE TABLE IF NOT EXISTS tipo_elemento (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hogar_id            UUID NOT NULL REFERENCES hogar(id),
    nombre              TEXT NOT NULL,
    categoria_sugerida  TEXT CHECK (categoria_sugerida IN
                          ('LIQUIDEZ', 'RESERVA', 'INVERSION', 'ACTIVO', 'DEUDA', 'CREDITO')),
    orden               INTEGER NOT NULL DEFAULT 0,
    estado              TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'ARCHIVADA')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (hogar_id, nombre)
);

CREATE INDEX IF NOT EXISTS ix_tipo_elemento_hogar
    ON tipo_elemento (hogar_id, estado, orden);

-- Backfill: sembrar el set por defecto en los hogares que ya existen
-- (los hogares nuevos lo siembran desde hogar.service). Debe coincidir con
-- api/src/tipo-elemento/tipos-elemento-default.ts.
INSERT INTO tipo_elemento (hogar_id, nombre, categoria_sugerida, orden)
SELECT h.id, d.nombre, d.categoria_sugerida, d.orden
FROM hogar h
CROSS JOIN (VALUES
    ('Cuenta corriente',       'LIQUIDEZ',  0),
    ('Cuenta vista',           'LIQUIDEZ',  1),
    ('Cuenta de ahorro',       'RESERVA',   2),
    ('Efectivo',               'LIQUIDEZ',  3),
    ('Depósito a plazo',       'RESERVA',   4),
    ('Fondo mutuo',            'INVERSION', 5),
    ('APV',                    'INVERSION', 6),
    ('Acciones',               'INVERSION', 7),
    ('Criptomonedas',          'INVERSION', 8),
    ('Propiedad',              'ACTIVO',    9),
    ('Vehículo',               'ACTIVO',    10),
    ('Crédito hipotecario',    'DEUDA',     11),
    ('Crédito de consumo',     'DEUDA',     12),
    ('Tarjeta de crédito',     'DEUDA',     13),
    ('Préstamo a un tercero',  'CREDITO',   14)
) AS d(nombre, categoria_sugerida, orden)
ON CONFLICT (hogar_id, nombre) DO NOTHING;
