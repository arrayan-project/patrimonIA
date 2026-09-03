# PatrimonIA — App

Cliente móvil. React Native + Expo (SDK 57, TypeScript).

## Puesta en marcha

```bash
npm install

# El backend debe estar corriendo (../api). En un dispositivo físico localhost
# no resuelve al PC — pasar la IP LAN:
EXPO_PUBLIC_API_URL=http://192.168.1.50:3000 npm start

npm run android   # emulador Android
npm run ios        # simulador iOS (requiere macOS)
npm run web        # navegador
```

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

### Decisiones del esqueleto (provisionales)

- Navegación por pila mínima hecha a mano (`src/navigation/`) — se reemplaza por
  `@react-navigation/native` cuando crezca el número de pantallas.
- Sesión (JWT) en memoria — se pierde al reiniciar. La persistencia
  (`expo-secure-store`) llega después.
- Dashboard muestra el primer hogar; el selector multi-hogar llega después.

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
