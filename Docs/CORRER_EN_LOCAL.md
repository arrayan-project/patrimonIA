# Cómo probar PatrimonIA en el teléfono

**Objetivo:** instructivo paso a paso para levantar la app en desarrollo —
con el backend en la nube (lo normal) o local (solo si vas a tocar `api/`) —
y para volver de un modo al otro sin dejar procesos colgados.

Desde el despliegue (2026-09-07) hay **dos escenarios**. El de arriba es el que
usás casi siempre.

| Quiero… | Modo | Comando de la app |
|---|---|---|
| Usar la app con lo que ya está en la nube | **A** | `./scripts/app.sh` |
| Probar cambios que aún no están en la nube (backend o una rama) | **B** | `./scripts/app-local.sh` (más `db.sh` y `api.sh` antes) |

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

# B · Probar con el backend en tu PC (local)

Úsalo cuando quieras probar **cambios que todavía no están en la nube**: código
del backend (`api/`) o una rama de la app que no se ha subido. Todo corre en tu
PC y el teléfono se conecta por la **misma WiFi**.

> **Lo más importante:** en este modo **no uses `./scripts/app.sh`**. Ese script
> abre un túnel por internet y la app termina buscando la API en un lugar donde
> no hay nada ("sin conexión"). Para local se usa **`./scripts/app-local.sh`**.

## Antes de la primera vez (una sola vez)

```bash
cd ~/Desktop/Projects/PersonalProjects/PatrimonIA/api && nvm use && npm install
sudo ufw allow 3000/tcp        # deja que el teléfono llegue al backend
sudo ufw allow 8081:8090/tcp   # deja que el teléfono llegue a Expo
```

## Cada vez: 3 terminales, en este orden

Abre tres terminales en `~/Desktop/Projects/PersonalProjects/PatrimonIA`.

| Terminal | Comando | Qué hace | ¿Se queda abierta? |
|---|---|---|---|
| 1 | `./scripts/db.sh` | Levanta la base de datos (Docker) | Termina sola |
| 2 | `./scripts/api.sh` | Levanta el backend en el puerto 3000 | **Sí**, ahí ves los logs |
| 3 | `./scripts/app-local.sh` | Levanta la app apuntando a tu backend y muestra el QR | **Sí** |

Después escanea el QR con el teléfono (igual que en el modo A).

- `app-local.sh` revisa que el backend esté arriba; si no lo está, te lo dice y
  no arranca.
- También muestra la dirección del backend (algo como `http://192.168.1.20:3000`).

### ¿Tengo que tocar `app/.env`?

**No.** Deja `app/.env` como está, con la línea **sin comentar**:

```
EXPO_PUBLIC_API_URL=https://patrimonia-q3lz.onrender.com
```

`app-local.sh` le pasa a la app la dirección de tu PC al arrancar, y esa le gana
a la del `.env`. **Si alguna vez la comentaste** (le pusiste `#` adelante),
descoméntala: quítale el `#` y guarda el archivo.

### Si la app dice "sin conexión"

1. En el **navegador del teléfono**, abre la dirección que mostró
   `app-local.sh` + `/health` (ej. `http://192.168.1.20:3000/health`).
2. **Si no carga**, el problema es la red, no la app:
   - ¿El teléfono y el PC están en la **misma WiFi**?
   - ¿Corriste `sudo ufw allow 3000/tcp`?
   - Si el PC está conectado al **hotspot del iPhone** (IP `172.20.10.x`), el
     iPhone que comparte la conexión a veces no puede entrar al PC. Conecta los
     dos a la misma WiFi normal.
   - En redes de oficina u hotel suele estar bloqueado: usa el modo A.
3. **Si carga** (`"status":"ok"`), cierra la app en el teléfono y vuelve a
   escanear el QR.

## Datos de prueba (opcional)

Con el backend corriendo:

```bash
./scripts/seed.sh
```

Crea estos usuarios:

```
demo@patrimonia.cl / demo1234       (admin)
pareja@patrimonia.cl / demo1234     (miembro)
```

## Diagnóstico

```bash
./scripts/estado.sh
```

## Terminar y volver al modo A (nube)

1. **Cortar backend y app:** `Ctrl+C` en las terminales 2 y 3, o:
   ```bash
   ./scripts/parar.sh
   ```
   (cierra lo que esté en los puertos 3000 y 8081; no toca Docker).

2. **Bajar la base de datos:**
   ```bash
   cd api/db && docker compose down && cd ../..
   ```
   Si además levantaste `banking-worker`, corre también `docker compose down`
   en la raíz del proyecto. Los datos **no se pierden** (quedan en el volumen
   `patrimonia_pgdata`). `docker ps` debe salir vacío.

3. **Revisar `app/.env`:** la línea `EXPO_PUBLIC_API_URL=...onrender.com` debe
   estar **sin `#`**. Si la comentaste, descoméntala y guarda.

4. **Arrancar la app en modo nube**, limpiando lo que quedó del modo local:
   ```bash
   ./scripts/app.sh --clear
   ```
   El `--clear` es importante: la app guarda la dirección del backend al
   arrancar; sin él podría seguir buscando tu PC.

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
| (modo B) La app dice "sin conexión" aunque el backend corre | Arrancaste la app con `./scripts/app.sh` (túnel) | Usa `./scripts/app-local.sh` |
| (modo B) `http://<ip>:3000/health` no carga en el teléfono | Firewall o AP isolation | `sudo ufw allow 3000/tcp`; si es red de oficina/hotel, usá el modo A (túnel) |
| `EADDRINUSE :::3000` | Backend viejo colgado | `./scripts/parar.sh` y de nuevo |
| `docker compose down` no bajó Postgres | `db.sh` la arrancó en un proyecto Docker separado (`patrimonia-db`) del de la raíz (`patrimonia`) | Bajar los dos por separado — ver "Terminar y volver al modo A" arriba |
| Cambié `app/.env` y la app sigue pegándole a la URL vieja | Metro solo lee `EXPO_PUBLIC_*` al arrancar | Matar Metro (`./scripts/parar.sh`) y arrancarlo de nuevo, no alcanza con recargar |

---

# Sin laptop (app 100% independiente)

Requiere un **build con EAS** + cuenta **Apple Developer (US$99/año)** para
instalar en un iPhone físico. No está montado todavía — cuando saques la cuenta,
se arma `eas.json` y el flujo de build.
