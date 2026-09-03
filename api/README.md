# PatrimonIA — API

Backend NestJS (ESM, NestJS 12). PostgreSQL vía Prisma.

## Puesta en marcha

```bash
# 1. Levantar la base de datos (desde api/db/)
cd db && docker compose up -d && cd ..

# 2. Configurar entorno
cp .env.example .env

# 3. Instalar y generar el cliente Prisma
npm install
npm run prisma:generate

# 4. Arrancar en desarrollo
npm run start:dev
```

## Healthcheck

```
GET http://localhost:3000/health
```

Devuelve `200` con `{ "status": "ok", ... }` cuando el proceso responde y la
conexión a PostgreSQL está viva (`@nestjs/terminus` + `PrismaHealthIndicator`).

## Prisma

- `prisma/schema.prisma` se genera por introspección de la DB real
  (`npm run prisma:pull`) — el esquema SQL en `db/init/01_schema.sql` es la
  fuente de verdad de la estructura en Fase 0. Prisma no gestiona migraciones
  todavía.
- `npm run prisma:generate` regenera el cliente tipado tras cada `pull`.

## Estructura

```
src/
  main.ts              arranque, CORS, shutdown hooks
  app.module.ts        composición raíz
  prisma/              PrismaService (cliente inyectable, @Global)
  health/              healthcheck de Fase 0
```

Los Application Services (52 casos de uso) y los endpoints `POST /comandos/{Nombre}`
se incorporan en Fase 1, un flujo vertical a la vez. Ver `Docs/BUILD_INSTRUCTIONS.docx`.
