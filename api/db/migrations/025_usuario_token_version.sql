-- ============================================================================
-- Migración 025 — usuario.token_version (reset de contraseña)
-- ============================================================================
-- GAPS.md G31. Contador que se incrementa al resetear la contraseña. Va como
-- claim `tv` en el JWT de sesión y en el token de reset; JwtAuthGuard y el
-- reset lo comparan contra la columna. Al incrementarlo:
--   - las sesiones emitidas antes del reset dejan de valer;
--   - el token de reset usado deja de valer (un solo uso, sin tabla aparte).
--
-- Aplicar en una DB existente:
--   docker exec -i patrimonia-postgres psql -U patrimonia -d patrimonia \
--     < api/db/migrations/025_usuario_token_version.sql
--   luego: npm run prisma:pull && npm run prisma:generate

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
