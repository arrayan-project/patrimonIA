# Cómo probar PatrimonIA en el teléfono

**Objetivo:** instructivo paso a paso para levantar la app en desarrollo —
con el backend en la nube (lo normal) o local (solo si vas a tocar `api/`) —
y para volver de un modo al otro sin dejar procesos colgados.

Desde el despliegue (2026-09-07) hay **dos escenarios**. El de arriba es el que
usás casi siempre.

---

# A · Usar la app con el backend en la nube  ← lo normal

El **backend y la base de datos ya están hospedados** (Render + Neon). Tu laptop
solo sirve para pasarle el **código de la app** al teléfono, vía Expo Go.

Con **modo túnel**, el teléfono se conecta desde **cualquier red** (datos
móviles, otra WiFi) — no hace falta estar en la misma que el PC.

## Configuración inicial (una sola vez)

1. **nvm + Node 22**: `nvm install 22` (los `.nvmrc` eligen la versión sola).
2. **Dependencias de la app**:
   ```bash
   cd ~/Desktop/Projects/PersonalProjects/PatrimonIA/app && nvm use && npm install
   ```
3. **Expo Go** instalado en el teléfono (App Store / Play Store).
4. **`app/.env`** ya existe y apunta a Render:
   ```
   EXPO_PUBLIC_API_URL=https://patrimonia-q3lz.onrender.com
   ```
   (si no está, crealo con esa línea — está en `.gitignore`).

## Cada vez que enciendo el laptop

**Una sola terminal:**
```bash
cd ~/Desktop/Projects/PersonalProjects/PatrimonIA
./scripts/app.sh
```

- Hace `nvm use` solo, limpia el puerto 8081 y arranca Expo **en modo túnel**.
- La primera vez tarda ~15 s en levantar el túnel; después muestra el **QR**.
- **Dejá esa terminal abierta** mientras uses la app.

## Conectar el teléfono

1. **iPhone**: abrí la **Cámara**, apuntá al QR, tocá la notificación → abre en Expo Go.
   **Android**: abrí Expo Go → "Scan QR code".
2. Si Expo pide iniciar sesión con cuenta de Expo: **no hace falta** para el túnel
   si ya estás logueado en el CLI. La primera vez quizás te pida
   `npx expo login` (cuenta gratis) — es para que el túnel funcione.
3. Primera pantalla: **Crear cuenta** (la base en Neon arranca vacía). El primer
   request puede tardar **~50 s** (Render despertando) + unos segundos (Neon).
   Después va fluido. Reintentá si el login se queda pensando.

## Parar

`Ctrl+C` en la terminal. El backend sigue vivo en Render — no lo tocás.

---

# B · Desarrollar el backend en local

Solo si vas a **tocar código del backend** (`api/`) y probarlo antes de subirlo.
Acá corren 3 piezas en tu PC y el teléfono va por la **misma WiFi**.

## Inicial (una vez)

```bash
docker volume create patrimonia_pgdata     # opcional, db.sh lo crea si falta
sudo ufw allow 3000/tcp
sudo ufw allow 8081:8090/tcp
cd ~/Desktop/Projects/PersonalProjects/PatrimonIA/api && nvm use && npm install
```

## Cada vez

**Terminal 1 — base de datos + backend:**
```bash
cd ~/Desktop/Projects/PersonalProjects/PatrimonIA
./scripts/db.sh
./scripts/api.sh          # dejá abierta
```

**Terminal 2 — Expo apuntando al backend local:**
```bash
cd ~/Desktop/Projects/PersonalProjects/PatrimonIA/app
# comentá temporalmente la línea de app/.env, o exportá la IP LAN:
EXPO_PUBLIC_API_URL="http://$(hostname -I | awk '{print $1}'):3000" npm start
```

> Si no seteás `EXPO_PUBLIC_API_URL`, `app/src/config.ts` infiere la IP LAN del
> PC — pero como `app/.env` ahora apunta a Render, hay que sobreescribirla acá.

## Datos de prueba (backend local)

```bash
./scripts/seed.sh     # con el backend corriendo
```
```
demo@patrimonia.cl / demo1234       (admin)
pareja@patrimonia.cl / demo1234     (miembro)
```

## Diagnóstico

```bash
./scripts/estado.sh
```

## Salir del modo B y volver al modo A (producción)

Paso a paso, en orden:

1. **Cortar backend y Metro**:
   ```bash
   cd ~/Desktop/Projects/PersonalProjects/PatrimonIA
   ./scripts/parar.sh
   ```
   Cierra lo que esté en los puertos 3000 y 8081. **No toca Docker** (a propósito).

2. **Bajar Docker** (Postgres, y `banking-worker` si lo usaste). Ojo: si
   arrancaste la base con `./scripts/db.sh`, quedó en un proyecto Docker
   distinto (`patrimonia-db`) del que usa `banking-worker`
   (`patrimonia`, definido en el `docker-compose.yml` de la raíz) — un solo
   `docker compose down` no baja los dos, hacen falta ambos:
   ```bash
   cd ~/Desktop/Projects/PersonalProjects/PatrimonIA
   docker compose down                 # banking-worker (si lo levantaste)
   cd api/db && docker compose down    # Postgres
   ```
   El volumen `patrimonia_pgdata` es externo — sobrevive a `docker compose down`
   sin importar cuál de los dos comandos lo toque; los datos no se pierden.
   Confirmar que no queda nada: `docker ps` debe salir vacío.

3. **Restaurar `app/.env`**: la línea `EXPO_PUBLIC_API_URL=https://patrimonia-q3lz.onrender.com`
   debe quedar **descomentada** (es el default de fábrica — si en el paso B la
   comentaste a mano en vez de exportar la variable inline, hay que
   descomentarla de nuevo acá).

4. **Reiniciar Expo normal**:
   ```bash
   cd ~/Desktop/Projects/PersonalProjects/PatrimonIA
   ./scripts/app.sh
   ```
   **Importante**: los `EXPO_PUBLIC_*` se inyectan al bundle una sola vez, al
   arrancar Metro — un simple refresh/hot-reload de la app **no** recoge el
   cambio de `.env`. Hay que matar el proceso de Metro viejo (`parar.sh` ya lo
   hace) y arrancarlo de nuevo.

---

# Subir cambios del backend a producción

1. Commit + `git push` a `main`.
2. Render redeploya solo (auto-deploy on push).
3. **Si el cambio incluye una migración** (`api/db/migrations/NNN_*.sql`),
   correla también contra Neon (ver `DESPLIEGUE.md` §1).

---

# Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| El túnel no arranca / "ngrok" error | Falta login de Expo | `cd app && npx expo login` (cuenta gratis) y de nuevo `./scripts/app.sh` |
| Login se queda pensando ~1 min la primera vez | Render + Neon despertando del suspend (free tier) | Esperá y reintentá. A partir de la 2ª request va rápido |
| "No se pudo conectar con el servidor" siempre | `app/.env` mal, o Render caído | Probá `https://patrimonia-q3lz.onrender.com/health` en el navegador → debe dar `{"status":"ok"}` |
| Expo Go: "There was a problem running the requested project" | Metro cayó / versión de Node | Mirá la terminal. `node -v` debe decir `v22.x` |
| (modo B) `http://<ip>:3000/health` no carga en el teléfono | Firewall o AP isolation | `sudo ufw allow 3000/tcp`; si es red de oficina/hotel, usá el modo A (túnel) |
| `EADDRINUSE :::3000` | Backend viejo colgado | `./scripts/parar.sh` y de nuevo |
| `docker compose down` no bajó Postgres | `db.sh` la arrancó en un proyecto Docker separado (`patrimonia-db`) del de la raíz (`patrimonia`) | Bajar los dos por separado — ver "Salir del modo B" arriba |
| Cambié `app/.env` y la app sigue pegándole a la URL vieja | Metro solo lee `EXPO_PUBLIC_*` al arrancar | Matar Metro (`./scripts/parar.sh`) y arrancarlo de nuevo, no alcanza con recargar |

---

# Sin laptop (app 100% independiente)

Requiere un **build con EAS** + cuenta **Apple Developer (US$99/año)** para
instalar en un iPhone físico. No está montado todavía — cuando saques la cuenta,
se arma `eas.json` y el flujo de build.
