import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { config } from 'dotenv';

// Los e2e hacen TRUNCATE de casi todas las tablas en cada beforeAll. Corren
// SIEMPRE contra la base de test (patrimonia_test), definida en api/.env.test —
// nunca contra la base real (patrimonia). Ver api/db/README.md § "Base de test".
const testEnv = config({ path: '.env.test' }).parsed ?? {};
if (!testEnv.DATABASE_URL?.includes('patrimonia_test')) {
  throw new Error(
    'api/.env.test debe apuntar a la base patrimonia_test — no se corren e2e contra otra base.',
  );
}

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Comparten una base real (patrimonia_test) y hacen TRUNCATE en beforeAll —
    // deben correr en serie, no en paralelo.
    fileParallelism: false,
    env: testEnv,
  },
});
