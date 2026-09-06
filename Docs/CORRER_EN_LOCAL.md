# Cómo dejar PatrimonIA andando en local

Guía práctica para probar la app en el teléfono. Pensada para el caso:
*"apagué el laptop, lo prendo y quiero seguir probando"*.

Hay **3 piezas** que tienen que estar corriendo a la vez:

| Pieza | Qué es | Dónde corre |
|-------|--------|-------------|
| **Base de datos** | PostgreSQL en Docker | contenedor `patrimonia-postgres`, puerto 5432 |
| **Backend** | la API (NestJS) | tu PC, puerto 3000 |
| **Expo** | el servidor que le pasa la app al teléfono | tu PC, puerto 8081 |

El teléfono se conecta por WiFi a los puertos 3000 y 8081 de tu PC.

---

## 1. Configuración inicial (una sola vez)

Si ya lo hiciste antes, salta al punto 2.

1. **Docker** instalado y funcionando (`docker ps` no debe dar error).
2. **nvm + Node 22**:
   ```bash
   nvm install 22
   ```
   (Los proyectos traen `.nvmrc`, así que `nvm use` en cada carpeta elige la
   versión correcta. Con Node 20 el backend **no arranca**.)
3. **Firewall** — abrir los puertos para que el teléfono llegue al PC:
   ```bash
   sudo ufw allow 3000/tcp
   sudo ufw allow 8081:8090/tcp   # rango: Expo a veces se corre al 8082, 8083…
   ```
4. **Dependencias** instaladas:
   ```bash
   cd ~/Desktop/WebSiteProject/PatrimonIA/api && nvm use && npm install
   cd ~/Desktop/WebSiteProject/PatrimonIA/app && nvm use && npm install
   ```
5. **Volumen de la base** (persiste entre reinicios; `down -v` no lo borra):
   ```bash
   docker volume create patrimonia_pgdata
   ```
   (`./scripts/db.sh` lo crea solo si falta, así que este paso es opcional.)
6. **App "Expo Go"** instalada en el teléfono (Play Store / App Store).

---

## 2. Cada vez que enciendo el laptop

Abre **2 terminales**. La base de datos se levanta sola al iniciar el PC
(Docker tiene `restart: unless-stopped`), pero el script la revisa igual.

**Terminal 1 — base de datos + backend:**
```bash
cd ~/Desktop/WebSiteProject/PatrimonIA
./scripts/db.sh      # levanta Postgres y espera a que esté listo
./scripts/api.sh     # arranca el backend — DEJA esta terminal abierta
```

**Terminal 2 — Expo:**
```bash
cd ~/Desktop/WebSiteProject/PatrimonIA
./scripts/app.sh     # muestra el QR — DEJA esta terminal abierta
```

> Los scripts hacen el `nvm use` por ti y verifican la versión de Node.
> Si `./scripts/...` da "Permission denied": `chmod +x scripts/*.sh`.

Cuando `./scripts/api.sh` diga
`PatrimonIA API escuchando en http://localhost:3000` y `./scripts/app.sh`
muestre el QR, ya está.

---

## 3. Conectar el teléfono

1. Teléfono en la **misma red WiFi** que el PC.
2. **Antes de escanear**, comprueba desde el navegador del teléfono:
   ```
   http://10.169.225.92:3000/health
   ```
   (Cambia la IP por la tuya — la ves con `hostname -I` o la imprime
   `./scripts/estado.sh`.) Debe mostrar un JSON `{"status":"ok",...}`.
   **Si eso no carga, la app tampoco** → ver "Problemas comunes".
3. Escanea el QR de la Terminal 2:
   - **Android**: ábrelo desde *dentro* de Expo Go ("Scan QR code").
   - **iPhone**: con la app **Cámara**, y toca la notificación.

> Si Expo te pide iniciar sesión con una cuenta de Expo: **no hace falta** para
> esto. Elige continuar sin cuenta / salta ese paso. (Una cuenta de Expo solo
> sirve para builds en la nube, que no usamos todavía.)

---

## 4. La cuenta para entrar a la app

**Opción rápida — datos de prueba ya armados.** Con el backend corriendo:

```bash
./scripts/seed.sh
```

Deja un escenario completo (hogar, deuda con detalle, objetivo compartido,
presupuesto, multimoneda…). Entra con:

```
demo@patrimonia.cl / demo1234       (admin del hogar)
pareja@patrimonia.cl / demo1234     (miembro)
```

Estos datos **se quedan** entre reinicios y entre corridas de tests — solo se
borran si vuelves a correr `./scripts/seed.sh` o borras el volumen (punto 7).

**Opción manual.** En la app, **"Crear cuenta"** → email + nombre + contraseña
(mínimo 8). Las siguientes veces, **"Iniciar sesión"** con lo mismo.

---

## 5. Verificar / diagnosticar

```bash
./scripts/estado.sh
```

Muestra tu IP y si cada pieza responde. Lo que tiene que verse:

```
Base de datos (Docker):   healthy
Backend  localhost:3000:   200
Backend  10.169.225.92:3000:   200      <- esto es lo que ve el teléfono
Expo/Metro localhost:8081: 200
```

---

## 6. Parar todo

- **Backend y Expo**: `Ctrl+C` en cada terminal.
- **Base de datos** (opcional, normalmente se deja):
  ```bash
  cd ~/Desktop/WebSiteProject/PatrimonIA/api/db && docker compose stop
  ```

---

## 7. Empezar de cero con los datos

**Lo normal** — con el backend corriendo, un solo comando:

```bash
./scripts/seed.sh
```

Borra todo y siembra el escenario de prueba. Es lo que quieres el 99% de las veces.

**Antes de algo riesgoso** (una migración grande, probar un comando destructivo):

```bash
./scripts/backup.sh                       # → backups/patrimonia_<fecha>.sql.gz
./scripts/restore.sh backups/<archivo>    # para volver atrás
```

**Reset total borrando el volumen** (raro — casi nunca hace falta):

```bash
cd ~/Desktop/WebSiteProject/PatrimonIA/api/db
docker compose down && docker volume rm patrimonia_pgdata
docker volume create patrimonia_pgdata && docker compose up -d
```

> ⚠️ **Nunca** `docker compose down -v` ni `docker volume prune` /
> `docker system prune --volumes` con datos que quieras conservar — esos borran
> el volumen. Los tests ya **no** tocan tu base (usan `patrimonia_test`).

---

## 8. Problemas comunes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `http://<ip>:3000/health` no carga en el teléfono, sí en el PC | Firewall | `sudo ufw allow 3000/tcp` y `sudo ufw allow 8081:8090/tcp` |
| No carga ni en el PC | El backend se cayó | Mira la Terminal 1. ¿Dice algo de Node? → `nvm use` y de nuevo `./scripts/api.sh` |
| Expo Go: *"There was a problem running the requested project"* | El teléfono no llega a Metro | Mismo WiFi + firewall (rango 8081:8090). |
| Expo Go: **"timed out"** y en la Terminal 2 dice *"Port 8081 is being used… Use port 8082?"* | Metro cayó a un puerto que el firewall no tiene abierto | Responde **yes** al 8082, y abre el rango una vez: `sudo ufw allow 8081:8090/tcp`. (Si el 8081 quedó "pegado" sin proceso dueño, un reinicio del PC lo limpia.) |
| Expo Go: "timed out" aunque el firewall esté abierto, y `./scripts/estado.sh` muestra tu IP como `10.x.x.x` | Red de campus/oficina/hotel que aísla los dispositivos entre sí | No hay arreglo simple: en esa red el teléfono no puede ver al PC. Prueba en una WiFi de casa, o usa un emulador Android en el PC (`./scripts/app.sh` y tecla `a`). |
| El backend arranca y se muere sin decir nada | Node 20 en vez de 22 | `node -v` debe decir `v22.x`. `nvm use` en `api/`. |
| El router separa los dispositivos ("AP isolation") | Red del hogar/hotel | Usa el emulador Android en el PC (`./scripts/app.sh`, tecla `a`), o prueba en otra WiFi. El `--tunnel` de Expo solo tunelea Metro, no el backend, así que no basta acá. |
| `EADDRINUSE: address already in use :::3000` | Quedó un backend viejo corriendo | `./scripts/parar.sh` y de nuevo `./scripts/api.sh` (que ya libera el puerto solo) |
| `docker ps` da error de permisos | Tu usuario no está en el grupo `docker` | `sudo usermod -aG docker $USER` y reinicia sesión |
| La app abre pero "no se pudo conectar con el servidor" | Backend caído, o IP cambió | `./scripts/estado.sh`. Si tu IP cambió, reinicia `./scripts/app.sh` (la app la infiere de Expo). |
