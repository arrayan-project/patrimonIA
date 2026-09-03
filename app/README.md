# PatrimonIA — App

Cliente móvil. React Native + Expo (SDK 57, TypeScript).

## Puesta en marcha

```bash
npm install

# El backend debe estar corriendo (../api, puerto 3000).
npm start          # escanear el QR con Expo Go
npm run android    # emulador Android
npm run ios         # simulador iOS (requiere macOS)
npm run web         # navegador
```

### ¿A qué backend se conecta?

`src/config.ts` resuelve la URL así:

1. `EXPO_PUBLIC_API_URL` si la defines (`EXPO_PUBLIC_API_URL=http://IP:3000 npm start`).
2. Si no, **infiere la IP del PC donde corre Expo** (la misma que muestra
   `npx expo start`) y asume el backend en `:3000`. En un teléfono real funciona
   sin configurar nada, estando en la misma WiFi.
3. Fallback: `localhost:3000` (emulador / navegador en el mismo PC).

## Estado

### Fase 1 — Flujo 2 (Alta de hogar)

Pantallas (Docs/UX_FLOWS.docx "Desglose — Flujo 2"):

| Pantalla | Comando/consulta |
|----------|------------------|
| Registro | `POST /comandos/RegistrarUsuario` (+ login automático) |
| Iniciar sesión | `POST /auth/login` |
| Bienvenida / Elegir camino | — (bifurcación de UX) |
| Crear Hogar | `POST /comandos/CrearHogar` |
| Invitaciones | `GET /usuarios/me/invitaciones` · `POST /comandos/AceptarInvitacion` / `RechazarInvitacion` |
| Dashboard del hogar | `GET /usuarios/me/hogares` · `GET /hogares/:id` · `POST /comandos/InvitarMiembro` (solo admin) |

Verificado: `tsc --noEmit` limpio, `expo-doctor` 21/21, `expo export` empaqueta
sin errores para android y web. La validación con simulador/navegador en vivo
queda pendiente de un entorno con GUI; el backend está probado end-to-end
(`../api/test/flujo2-alta-hogar.e2e-spec.ts`) contra los mismos endpoints.

### Fase 2 — Flujo 1 (día a día financiero)

| Pantalla | Comando/consulta |
|----------|------------------|
| Dashboard (ampliado) | `GET /usuarios/me/patrimonio-individual` · `GET /elementos-patrimoniales?propietario=me` |
| Agregar elemento | `POST /comandos/RegistrarElementoPatrimonial` |
| Registrar movimiento | `POST /comandos/RegistrarEventoFinanciero` (INGRESO/GASTO/TRANSFERENCIA) |
| Detalle de elemento | `GET /elementos-patrimoniales/:id` · `GET /eventos-financieros?elemento=:id` |

### Decisiones del esqueleto (provisionales)

- Navegación por pila mínima hecha a mano (`src/navigation/`) — se reemplaza por
  `@react-navigation/native` cuando crezca el número de pantallas.
- Sesión (JWT) en memoria — se pierde al reiniciar. La persistencia
  (`expo-secure-store`) llega después.
- Dashboard muestra el primer hogar; el selector multi-hogar llega después.
- "Registrar movimiento" solo lista tus propios elementos como destino; para
  transferir a otra persona hay que conocer el id de su elemento (ver GAPS.md G6).

## Estructura

```
src/
  config.ts            API_URL (EXPO_PUBLIC_API_URL)
  api/client.ts        wrapper fetch + tipos de respuesta
  auth/AuthContext.tsx  sesión, registrar / iniciarSesion / cerrarSesion
  navigation/           pila mínima (NavProvider / useNav)
  ui/                   componentes compartidos
  screens/              una pantalla por archivo
  AuthFlow.tsx          sin sesión: Registro / Login
  AppFlow.tsx           con sesión: Bienvenida / CrearHogar / Invitaciones / Dashboard
```
