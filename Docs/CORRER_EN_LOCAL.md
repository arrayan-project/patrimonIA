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
   sudo ufw allow 8081/tcp
   ```
4. **Dependencias** instaladas:
   ```bash
   cd ~/Desktop/WebSiteProject/PatrimonIA/api && nvm use && npm install
   cd ~/Desktop/WebSiteProject/PatrimonIA/app && nvm use && npm install
   ```
5. **App "Expo Go"** instalada en el teléfono (Play Store / App Store).

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

**No hay usuario de prueba.** La primera vez, en la app:

- Pantalla **"Crear cuenta"** → email + nombre + contraseña (mínimo 8).
  Los inventas tú; quedan guardados en tu base de datos local.
- Las siguientes veces: **"Iniciar sesión"** con ese mismo email y contraseña.

Si reseteas la base de datos (punto 7), esa cuenta se borra y hay que crearla
de nuevo.

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

Borra **todos** los usuarios, hogares, elementos y movimientos, y vuelve a
aplicar el esquema:

```bash
cd ~/Desktop/WebSiteProject/PatrimonIA/api/db
docker compose down -v && docker compose up -d
```

---

## 8. Problemas comunes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `http://<ip>:3000/health` no carga en el teléfono, sí en el PC | Firewall | `sudo ufw allow 3000/tcp` y `sudo ufw allow 8081/tcp` |
| No carga ni en el PC | El backend se cayó | Mira la Terminal 1. ¿Dice algo de Node? → `nvm use` y de nuevo `./scripts/api.sh` |
| Expo Go: *"There was a problem running the requested project"* | El teléfono no llega a Metro (8081) | Mismo WiFi + firewall (8081). Última opción: `./scripts/app.sh --tunnel` |
| El backend arranca y se muere sin decir nada | Node 20 en vez de 22 | `node -v` debe decir `v22.x`. `nvm use` en `api/`. |
| El router separa los dispositivos ("AP isolation") | Red del hogar/hotel | `./scripts/app.sh --tunnel` (más lento, pasa por servidores de Expo) |
| `EADDRINUSE: address already in use :::3000` | Quedó un backend viejo corriendo | `./scripts/parar.sh` y de nuevo `./scripts/api.sh` (que ya libera el puerto solo) |
| `docker ps` da error de permisos | Tu usuario no está en el grupo `docker` | `sudo usermod -aG docker $USER` y reinicia sesión |
| La app abre pero "no se pudo conectar con el servidor" | Backend caído, o IP cambió | `./scripts/estado.sh`. Si tu IP cambió, reinicia `./scripts/app.sh` (la app la infiere de Expo). |
