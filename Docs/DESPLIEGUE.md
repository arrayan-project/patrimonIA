# Despliegue — PatrimonIA

Stack: **Expo (local, sin cambios)** → **Render** (NestJS) → **Neon** (PostgreSQL).
Coste objetivo: **$0/mes** (planes gratuitos de Render y Neon).

> Esto es una tarde de trabajo, no un proyecto. Los pasos van en orden; cada uno
> se valida antes de pasar al siguiente.

---

## 0 · Antes de empezar — secretos

**No reutilices el `JWT_SECRET` de desarrollo.** El backend en Render es, técnicamente,
tu primer entorno accesible desde internet. Genera uno nuevo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Guárdalo — va como variable de entorno en Render (paso 3), nunca en el repo.

Variables de entorno del backend (`api/src` las lee vía `@nestjs/config`):

| Var | Obligatoria | Valor en Render |
|---|---|---|
| `DATABASE_URL` | sí | connection string de Neon (paso 1), con `?sslmode=require` |
| `JWT_SECRET` | sí (`getOrThrow` — sin ella el proceso no arranca) | el que generaste arriba |
| `PORT` | la pone Render sola | — |
| `AUTH_REGISTRO_TOKEN_REQUERIDO` | no | `false` por ahora (aún no hay captcha — GAPS G4) |
| `EMAIL_SENDER` / `PUSH_SENDER` | no | sin definir → usan los adapters de consola (no envían nada real) |

---

## 1 · Neon (base de datos)

1. Crear cuenta en [neon.tech](https://neon.tech), crear un proyecto (región cercana).
2. Copiar la **connection string** (formato `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
3. Cargar el esquema. **No usamos `prisma migrate`** — el esquema vive en SQL a mano:

   ```bash
   # el esquema consolidado (todas las tablas + las 24 migraciones ya plegadas)
   psql "postgresql://...neon...?sslmode=require" -f api/db/init/01_schema.sql
   ```

   Si `psql` no está instalado, usa el **SQL Editor** de la consola de Neon y pega
   el contenido de `api/db/init/01_schema.sql`.

4. **Validar** antes de tocar Render:

   ```bash
   psql "postgresql://...neon...?sslmode=require" -c "\dt"
   ```

   Deben aparecer ~32 tablas (`hogar`, `usuario`, `elemento_patrimonial`, …).

> Neon free tier **autosuspende** la DB tras ~5 min sin uso; la primera consulta
> después la despierta (~0,5 s). No pasa nada, es esperado.

---

## 2 · Render (backend NestJS)

### Opción A — Blueprint (recomendado, versionado en el repo)

El repo trae `render.yaml`. En Render: **New → Blueprint**, apunta a tu repo, y
Render crea el Web Service leyendo ese archivo. Solo tendrás que rellenar los
valores de `DATABASE_URL` y `JWT_SECRET` (marcados `sync: false`).

### Opción B — a mano

1. Conectar el repo de GitHub en Render → **New → Web Service**.
2. Configuración:
   - **Root Directory**: `api`
   - **Runtime**: Node
   - **Build Command**: `npm ci && npx prisma generate && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Health Check Path**: `/health`
   - **Node version**: la toma de `api/.nvmrc` (22.22.1) / `engines` — no la fuerces a mano.
3. **Environment**: añadir `DATABASE_URL` y `JWT_SECRET` (paso 0).
4. Deploy. Cuando termine, `GET https://<tu-servicio>.onrender.com/health` debe
   responder `{"status":"ok", ...}` con `database: up`.

> Render free tier **duerme** el servicio tras 15 min sin tráfico; la primera
> request después tarda ~50 s en despertar. Aceptable para desarrollo/demo.

---

## 3 · App (Expo, local)

Solo cambia la URL base de la API. `app/src/config.ts` ya respeta
`EXPO_PUBLIC_API_URL`:

```bash
# app/.env  (o exportarla antes de `npx expo start`)
EXPO_PUBLIC_API_URL=https://<tu-servicio>.onrender.com
```

Las variables `EXPO_PUBLIC_*` se **inyectan al bundle en build/start** — reinicia
`expo start` tras cambiarla. Sin la variable, la app sigue infiriendo la IP LAN
para el backend local (comportamiento actual, útil para volver a desarrollo).

---

## 4 · Prueba end-to-end (contra el backend hospedado, no local)

Con `EXPO_PUBLIC_API_URL` apuntando a Render:

1. **Registro** → crear una cuenta nueva (la DB de Neon está vacía).
2. **Crear hogar**.
3. **Agregar cuenta o bien** (elemento LIQUIDEZ con saldo inicial).
4. **Registrar movimiento** (un gasto).
5. Verificar en **Movimientos** que aparece, y en **Inicio** que el patrimonio bajó.
6. Opcional: `psql` a Neon → `SELECT comando, fecha_hora FROM auditoria ORDER BY fecha_hora DESC LIMIT 10;` para ver la traza.

---

## Notas

- **Migraciones futuras**: cuando se añada una migración nueva (`api/db/migrations/NNN_*.sql`),
  hay que correrla también contra Neon (`psql ... -f api/db/migrations/NNN_*.sql`)
  y hacer `prisma:pull` + `prisma:generate` en local. No hay automatización — es
  el mismo flujo manual de `api/db/README.md`.
- **CORS**: `main.ts` ya hace `app.enableCors()` (permisivo). Suficiente para
  Expo web; la app nativa no usa CORS.
- **Backups**: Neon free tier conserva 24 h de historial (point-in-time restore).
  Para algo serio, `pg_dump` periódico.
- **Logs**: en el dashboard de Render (pestaña Logs). El backend loguea el
  arranque y cada request fallida.
