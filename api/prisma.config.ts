import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: la URL de conexión para comandos de CLI (db pull, migrate) vive aquí,
// no en schema.prisma. El cliente en runtime usa el driver adapter (ver PrismaService).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
