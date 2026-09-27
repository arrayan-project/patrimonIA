# Despliegue — PatrimonIA

**Objetivo:** cómo hospedar el backend y la base de datos (una sola vez), y
qué hacer cada vez que hay una migración o un cambio nuevo que subir. No es
para el día a día de desarrollo — para eso, `CORRER_EN_LOCAL.md`.

Stack: **Expo (local, sin cambios)** → **Render** (NestJS) → **Neon** (PostgreSQL).
Coste objetivo: **$0/mes** (planes gratuitos de Render y Neon).

> Esto es una tarde de trabajo, no un proyecto. Los pasos van en orden; cada uno
> se valida antes de pasar al siguiente.

## Estado

**Pendiente**

- [ ] **Captcha antes del registro** — mientras no exista,
  `AUTH_REGISTRO_TOKEN_REQUERIDO` queda en `false` (GAPS G4).
- [ ] **Dominio propio para el email** — hoy el remitente es un email verificado
  en Brevo y los correos pueden caer en spam; con dominio, autenticarlo
  (SPF/DKIM) y cambiar `EMAIL_REMITENTE` (§2b).
- [ ] **Backups propios** — hoy solo el historial de 24 h de Neon (ver Notas).

**Hecho**

- [x] §0 Secretos de producción generados.
- [x] §1 Neon — esquema cargado (2026-09-06); migraciones aplicadas hasta la
  **025** (2026-09-26).
- [x] §2 Render — backend desplegado desde `main` (auto-deploy en cada push).
- [x] §2b Brevo — emails reales de reset de contraseña (2026-09-27).
- [x] §3–4 App apuntando a Render y prueba end-to-end, incluido el reset de
  contraseña (2026-09-27).

---

## 0 · Antes de empezar — secretos

**No reutilices el `JWT_SECRET` de desarrollo.** El backend en Render es, técnicamente,
tu primer entorno accesible desde internet. Genera uno nuevo:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Guárdalo — va como variable de entorno en Render (paso 2), nunca en el repo.

Variables de entorno del backend (`api/src` las lee vía `@nestjs/config`):

| Var | Obligatoria | Valor en Render |
|---|---|---|
| `DATABASE_URL` | sí | connection string de Neon (paso 1), con `?sslmode=require` |
| `JWT_SECRET` | sí (`getOrThrow` — sin ella el proceso no arranca) | el que generaste arriba |
| `PORT` | la pone Render sola | — |
| `AUTH_REGISTRO_TOKEN_REQUERIDO` | no | `false` por ahora (aún no hay captcha — GAPS G4) |
| `BREVO_API_KEY` | no, pero sin ella **no se envían emails** (reset de contraseña, token de registro) — solo van al log | API key de Brevo (SMTP & API → API Keys) |
| `EMAIL_REMITENTE` | sí, si hay `BREVO_API_KEY` (sin ella el proceso no arranca) | el email verificado en Brevo → Senders |
| `EMAIL_REMITENTE_NOMBRE` | no | nombre visible del remitente; por defecto `PatrimonIA` |

---

## 1 · Neon (base de datos)  — ✅ hecho (2026-09-06)

- Proyecto: `twilight-truth-92618037`, branch `production`, región `us-east-2`, PostgreSQL 18.
- Esquema **cargado y verificado**: 32 tablas (todas las migraciones 001–024 plegadas).
- Migración **025** (`usuario.token_version`) aplicada a mano el 2026-09-26 desde
  el SQL Editor de la consola de Neon.
- La connection string (pooled) va como `DATABASE_URL` en Render (paso 2). **Es un
  secreto** — no la pongas en el repo; solo en Render (y, si corres el backend
  local contra Neon, en `api/.env`, que está en `.gitignore`).

**Cómo se hizo** (para reproducir si hay que recrear la DB):

```bash
# no hace falta psql instalado — se usa la imagen postgres:16 de Docker
docker run --rm -i postgres:16 psql -v ON_ERROR_STOP=1 \
  "postgresql://…neon…-pooler…?sslmode=require" < api/db/init/01_schema.sql
# validar:
docker run --rm -i postgres:16 psql "postgresql://…neon…?sslmode=require" -c "\dt"
```

**NO uses `neon config init` / `neon.ts` / `neon deploy`.** Ese es el sistema de
migraciones propio de Neon y **choca** con el de este proyecto (SQL a mano en
`api/db/migrations/` + `prisma db pull`). El `neon` CLI sí sirve para
`login` / `link` / abrir la consola, pero la gestión de esquema sigue el flujo de
`api/db/README.md`.

**Migración nueva** (cuando se agregue `api/db/migrations/NNN_*.sql`): correrla
también contra Neon **antes** de hacer push del código que la usa (Render
despliega solo en cada push). Lo más simple es pegar el SQL en la consola de Neon
→ **SQL Editor** (branch `production`, base `neondb`); si no, el mismo
`docker run … psql … < …NNN.sql`. Si la consola marca la branch como
*archived*, es solo porque estuvo sin uso; consultarla la reactiva.

> Neon free tier **autosuspende** la DB tras ~5 min sin uso; la primera consulta
> después la despierta (~0,5 s). Es esperado.

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
3. **Environment** (pestaña *Environment* del servicio → *Environment Variables* → *Add*):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | la connection string **pooled** de Neon, entre comillas no, tal cual: `postgresql://neondb_owner:…@ep-…-pooler.…neon.tech/neondb?sslmode=require` |
   | `JWT_SECRET` | el secreto generado en el paso 0 (no el de `api/.env`) |
   | `AUTH_REGISTRO_TOKEN_REQUERIDO` | `false` |
   | `BREVO_API_KEY` | API key de Brevo (ver "Email" abajo) |
   | `EMAIL_REMITENTE` | el email verificado como sender en Brevo |

   `PORT` la inyecta Render sola — no la agregues. Si el arranque falla con un
   error de `channel_binding`, quita `&channel_binding=require` de la URL.

4. Deploy. Cuando termine, `GET https://<tu-servicio>.onrender.com/health` debe
   responder `{"status":"ok", ...}` con `database: up`.

> Render free tier **duerme** el servicio tras 15 min sin tráfico; la primera
> request después tarda ~50 s en despertar. Aceptable para desarrollo/demo.

---

## 2b · Email (Brevo) — para reset de contraseña y token de registro

Sin esto el backend funciona, pero los emails solo quedan en el log de Render
(nadie recibe el código de "¿Olvidaste tu contraseña?"). GAPS G31.

1. Crear cuenta gratis en brevo.com (300 emails/día).
2. **Senders, Domains & Dedicated IPs → Senders → Add a sender**: tu email
   (p. ej. el Gmail). Brevo manda un correo de confirmación — abrirlo.
3. **SMTP & API → API Keys → Generate a new API key**. Copiarla (se muestra una
   sola vez).
4. En Render → Environment: `BREVO_API_KEY` = la key, `EMAIL_REMITENTE` = el
   email del paso 2. Guardar (Render redespliega solo).
5. Probar: en la app, "¿Olvidaste tu contraseña?" con tu email → debe llegar el
   código. Si no llega, revisar spam y el log de Render (`No se pudo enviar el
   email de reset: …`).

> Sin dominio propio el remitente es un Gmail/Outlook, y esos correos pueden
> caer en spam. Si más adelante hay dominio, verificarlo en Brevo (SPF/DKIM) y
> cambiar `EMAIL_REMITENTE`.

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
