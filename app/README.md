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

### Fase 3 — Flujo 6 (corregir / anular un movimiento)

| Pantalla | Comando/consulta |
|----------|------------------|
| Detalle de elemento | movimientos tappables; anulados tachados, correcciones etiquetadas |
| Detalle de movimiento | `GET /eventos-financieros/:id` · `POST /comandos/CorregirEventoFinanciero` · `POST /comandos/AnularEventoFinanciero` |

### Fase 4 — Flujo 3 (valorización)

| Pantalla | Comando/consulta |
|----------|------------------|
| Agregar elemento | toggle "¿se valoriza en el tiempo?" → `admiteValorizacion` |
| Detalle de elemento | sección Valorizaciones (si el elemento la admite) + botón Registrar |
| Registrar valorización | `POST /comandos/RegistrarValorizacion` |
| Detalle de valorización | `POST /comandos/CorregirValorizacion` · `POST /comandos/AnularValorizacion` (solo la última vigente) |

### Fase 5 — ajustes, ciclo de vida, objetivos

| Pantalla | Qué hace |
|----------|----------|
| Detalle de elemento → Ajustes | RegistrarAjuste / detalle con Corregir / Anular |
| Detalle de elemento → Editar / estado | ActualizarDatos, CambiarVisibilidad, Desactivar/Reactivar, Eliminar |
| Dashboard → Gestionar hogar | editar nombre, roles, remover miembro, salir / eliminar |
| Dashboard → Mi perfil | ActualizarDatosUsuario, DesactivarUsuario |
| Dashboard → Objetivos financieros | lista + crear; detalle con barra de progreso, asignaciones, estado |
| Detalle de asignación | reservas activas, crear/liberar reserva, eliminar asignación |

### Fase 6 — Presupuesto

| Pantalla | Comando/consulta |
|----------|------------------|
| Dashboard → Presupuestos | `GET /presupuestos` · `POST /comandos/CrearPresupuesto` |
| Detalle de presupuesto | `GET /presupuestos/:id` · `GET /presupuestos/:id/desviacion` (con `porRubro`) · `ActualizarDatosPresupuesto` / `CerrarPresupuesto` / `EliminarPresupuesto` |
| Presupuesto por rubro (15d) | `GET /presupuestos/:id/lineas` · `POST /comandos/DefinirLineasPresupuesto` |

### Fase 7 — Movimiento Programado

| Pantalla | Comando/consulta |
|----------|------------------|
| Dashboard → Movimientos programados | `GET /movimientos-programados` · `POST /comandos/CrearMovimientoProgramado` |
| Detalle de movimiento programado | `GET /movimientos-programados/:id` · `MaterializarMovimientoProgramado` / `ActualizarMovimientoProgramado` / `CancelarMovimientoProgramado` |

### Fase 8 — Deuda / Crédito

| Pantalla | Comando/consulta |
|----------|------------------|
| Agregar elemento | categoría DEUDA/CREDITO → `valorPendiente` en vez de valor inicial |
| Detalle de elemento (deuda/crédito) | saldo pendiente · `POST /comandos/CondonarDeuda` / `POST /comandos/DeclararIncobrable` |

### Fase 9 — Reconstrucción histórica

| Pantalla | Comando/consulta |
|----------|------------------|
| Dashboard → Evolución de mi patrimonio | `GET /usuarios/me/variacion-patrimonial` + `GET /usuarios/me/serie-patrimonial` (gráfico de línea, 15g) |

### Fase 10 — Consolidación y métricas del hogar

| Pantalla | Comando/consulta |
|----------|------------------|
| Dashboard → Patrimonio del hogar | `GET /hogares/:id/patrimonio-consolidado` · `GET /hogares/:id/metricas` |

### Fase 11 — Notificaciones

| Pantalla | Comando/consulta |
|----------|------------------|
| Dashboard → Notificaciones (N) | `GET /usuarios/me/notificaciones` · `POST .../:id/leer` · `POST .../leer-todas` |

### Fase 13 — Multimoneda

| Pantalla | Comando/consulta |
|----------|------------------|
| Dashboard → Tipos de cambio | `GET /tipos-cambio` · `POST /comandos/RegistrarTipoCambio` |
| Registrar movimiento → CONVERSION | `POST /comandos/RegistrarEventoFinanciero` (tipo CONVERSION) |
| Patrimonio del hogar | total en la moneda de consolidación (o monedas faltantes) |

### Fase 14 — Deuda técnica

- **Navegación** (14a): `@react-navigation/native` (native-stack). Las pantallas
  siguen usando `useNav()` — ahora una fachada sobre `useNavigation`/`useRoute`
  (`src/navigation/navigator.tsx`). El árbol se arma en `RootNavigator.tsx`.
- **Sesión persistida** (14a): el JWT se guarda en `expo-secure-store` (nativo) o
  `localStorage` (web) — `src/auth/secureStorage.ts`. Al arrancar se restaura y
  se valida contra `GET /usuarios/me`.
- **Multi-hogar** (14a): si perteneces a más de un hogar, el Dashboard muestra un
  selector; la elección se recuerda por usuario.
- **Registro con token** (14c): `RegistroScreen` pide el token de registro a
  `/auth/registro-token`; si el backend lo envía por email (modo producción),
  pide el código.
- **Push** (14c): al iniciar sesión, `src/push/registerPush.ts` obtiene el Expo
  push token y lo registra en `/usuarios/me/dispositivos-push` (null en web /
  simulador / Expo Go — necesita un development build + `projectId` de EAS).

### Fase 15 — UI / UX (`Docs/UI_UX_BACKLOG.md`)

- **15a–15c**: auto-refresh al enfocar, pull-to-refresh, `Idempotency-Key`,
  `DateField` / `MoneyField` / `ToastProvider` / `confirmar()`, glosa y
  categorías de movimiento, pantalla Ajustes.
- **15d**: presupuesto por rubro (`PresupuestoRubros` + sección "Por rubro").
- **15e — navegación**: barra de **tabs inferior** (`@react-navigation/bottom-tabs`)
  con Inicio · Movimientos · Objetivos · Hogar · Ajustes; cada tab es la raíz de
  su navegación y las pantallas de detalle/formulario se apilan encima con
  **header nativo** (título + botón atrás) — se quitaron los enlaces "Volver".
  `MovimientosScreen` y `HogarScreen` son hubs (`MenuLink` / `GroupLabel`); el
  Dashboard queda con patrimonio + elementos + acciones frecuentes.
- **15f — textos**: `src/labels.ts` (`etiqueta()` / `humanizar()`) traduce los
  enums; `fechaRelativa()` en notificaciones.
- **15g — gráficos**: `react-native-svg` + `src/ui/charts.tsx` (`Dona`,
  `GraficoLinea`); dona en presupuesto por rubro y patrimonio del hogar, línea
  en evolución; tarjeta de resumen del Dashboard; iconos de tabs (Ionicons).

### Decisiones aún provisionales

- "Registrar movimiento" solo lista tus propios elementos como destino; para
  transferir a otra persona hay que conocer el id de su elemento (ver GAPS.md G6).

## Estructura

```
src/
  config.ts             API_URL (EXPO_PUBLIC_API_URL)
  api/client.ts         wrapper fetch + tipos de respuesta
  auth/AuthContext.tsx  sesión persistida (registrar / iniciarSesion / cerrarSesion)
  auth/secureStorage.ts secure-store (nativo) / localStorage (web)
  navigation/navigator.tsx    fachada useNav() sobre @react-navigation
  navigation/RootNavigator.tsx  árbol de navegación (auth vs. app)
  ui/                   componentes compartidos
  screens/              una pantalla por archivo
```
