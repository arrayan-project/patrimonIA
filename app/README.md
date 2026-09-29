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

### Pendiente

Detalle y prioridad en `../GAPS.md` → Parte 1. Lo que toca la app:

- [ ] **Evaluación de usabilidad del flujo completo** para un usuario nuevo
  (G32): onboarding, mapa de navegación, conexión entre secciones.
- [ ] **Push remoto real** (G20): necesita un development build + `projectId`
  de EAS.
- [ ] **Densidad** (compacta/cómoda) en Ajustes › Visualización (resto de G25).
- [ ] `ListItem` en Categorías y Tipos de elemento — diferido a propósito (U3).

### Implementado

Journal por fase (Fases 1–19). Las fases 20 en adelante (rediseño,
reorganización de la navegación, pulido) están descritas en
`../Docs/diseño/UX_FLOWS.md` Parte 3.

- **Recuperación de contraseña** (G31): link "¿Olvidaste tu contraseña?" en
  Login → `RecuperarPasswordScreen` (email → código + nueva contraseña → vuelta
  a Login). Verificado en producción el 2026-09-27. Desde el 2026-09-29 el
  código es de 6 dígitos (campo numérico con autocompletado), también en el
  registro (G4).
- **Preferencias de visualización** (G25): Ajustes › Visualización — formato de
  fecha, moneda principal del Inicio y secciones visibles. `src/preferencias.tsx`
  (`PreferenciasProvider`), guardadas en `usuario.preferencias.visualizacion`.
- **Valorizaciones** (G11): Corregir / Anular en cualquier valorización vigente
  sin corregir, no solo la última.

### Fase 1 — Flujo 2 (Alta de hogar)

Pantallas (Docs/UX_FLOWS.md "Desglose — Flujo 2"):

| Pantalla | Comando/consulta |
|----------|------------------|
| Registro | `POST /comandos/RegistrarUsuario` (+ login automático) |
| Iniciar sesión | `POST /auth/login` |
| Bienvenida / Elegir camino | — (bifurcación de UX) |
| Crear Hogar | `POST /comandos/CrearHogar` |
| Invitaciones | `GET /usuarios/me/invitaciones` · `POST /comandos/AceptarInvitacion` / `RechazarInvitacion` |
| Dashboard del hogar | `GET /usuarios/me/hogares` · `GET /hogares/:id` · `POST /comandos/InvitarMiembro` (solo admin) |

Verificado: `tsc --noEmit` limpio, `expo-doctor` 21/21, `expo export` empaqueta
sin errores para android y web; el backend está probado end-to-end
(`../api/test/flujo2-alta-hogar.e2e-spec.ts`) contra los mismos endpoints. (En
ese momento faltaba probarlo en vivo; hoy se usa en el teléfono con Expo Go.)

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
| Plantillas de movimiento (15h) | `GET /usuarios/me/plantillas-movimiento` · `CrearPlantillaMovimiento` / `ActualizarPlantillaMovimiento` / `EliminarPlantillaMovimiento` |
| Etiquetas (15i) | `GET /usuarios/me/etiquetas` · `CrearEtiqueta` / `ActualizarEtiqueta` / `EliminarEtiqueta` / `EtiquetarEvento` |
| Agrupaciones de elementos (15j) | `GET /usuarios/me/agrupaciones` · `CrearAgrupacion` / `ActualizarAgrupacion` / `EliminarAgrupacion` / `DefinirElementosAgrupacion` |

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
  `/auth/registro-token`; si el backend envía un código por email (modo
  producción), pide los 6 dígitos y los canjea por el token en
  `/auth/verificar-codigo-registro` (G4).
- **Push** (14c): al iniciar sesión, `src/push/registerPush.ts` obtiene el Expo
  push token y lo registra en `/usuarios/me/dispositivos-push` (null en web /
  simulador / Expo Go — necesita un development build + `projectId` de EAS).

### Fase 15 — UI / UX (`Docs/retirado/UI_UX_BACKLOG.md`)

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
- **15h — plantillas**: `PlantillasScreen` (CRUD de moldes personales); selector
  "Desde una plantilla" arriba de "Registrar movimiento"; "Guardar como
  plantilla" en el detalle de un movimiento (deriva origen/destino de los
  impactos). Usar una plantilla solo rellena `RegistrarEventoFinanciero`.
- **15i — etiquetas**: `EtiquetasScreen` (Ajustes → Cuenta); componente `Chip`;
  chips seleccionables al registrar un movimiento (`RegistrarEventoFinanciero.
  etiquetaIds`) y en el detalle ("Editar etiquetas" → `EtiquetarEvento`).
- **15j — agrupaciones**: `AgrupacionesScreen` (Ajustes → Cuenta): carpetas
  personales para tus elementos (una por elemento). La lista de "Elementos" del
  Inicio se muestra agrupada por carpeta, con "Sin agrupar" al final.
- **15k — controles de entrada**: componente `Select` (hoja modal con lista
  scrollable + opción "Otro…" para texto libre) — usado para categoría
  funcional, `tipo` de elemento (presets de `labels.ts`) y moneda (ISO 4217).
  `Screen` envuelve el scroll en `KeyboardAvoidingView`. `MoneyText` pinta los
  montos negativos en rojo (opción `contable` = paréntesis).
- **15l — pulido**: `icon` (Ionicons) en `MenuLink` — aplicado en los hubs;
  componente `EmptyState` (ícono + texto + acción) en las 8 listas principales;
  las notificaciones abren su entidad al tocarlas (`destino()` mapea
  `entidadTipo` → ruta); card "Primeros pasos" en el Dashboard (secure-store
  `patrimonia.onboarding.<uid>`).

### Fase 16 — Reportes financieros + reorganización de tabs

- **`MovimientosScreen`** deja de ser un hub y pasa a ser la **vista mensual /
  anual**: selector `‹ mes/año ›`, toggles Mes/Año y Míos/Del hogar, tarjeta de
  totales (ingresos · gastos · balance, con comparación al período anterior),
  `Dona` de gastos por rubro, lista de movimientos, y `GraficoBarras` (ingreso
  vs. gasto por mes) en modo Año. Consume `GET /usuarios/me/resumen-financiero`
  y `/resumen-anual`.
- Nueva tab **Planificar** (`PlanificarScreen`): Objetivos + Presupuestos +
  Movimientos programados + Plantillas + Evolución de mi patrimonio. `Objetivos`
  deja de ser tab y pasa a pantalla apilada.
- El **Dashboard** suelta el bloque "Miembros del hogar" + formulario de invitar
  (ahora en `GestionHogarScreen`). Las **categorías del hogar** y **tipos de
  cambio** pasan de Ajustes a la tab **Hogar** (grupo "Configuración del hogar").
  Ajustes queda solo con lo personal.
- `charts.tsx` gana `GraficoBarras`.

### Fase 17 — Sistema visual + ayuda contextual

- **Tokens**: `colors.fondo` (gris suave para la página), `colors.info` (tinte
  de ayuda), `sombra` (sombra sutil compartida). El `Screen` va sobre
  `colors.fondo` y las tarjetas (fondo blanco, `borderRadius: 14`) resaltan
  (sweep de `styles.card` en 26 pantallas).
- **`Card`** (`ui/index.tsx`): tarjeta blanca; con `onPress` es tocable y
  muestra un chevron "ver más"; `franja` pinta una barra de color a la
  izquierda. Usada en las listas de Objetivos / Presupuestos / Mov. programados.
- **`Ayuda`**: caja con ícono de info + explicación breve sobre fondo azul
  tenue; reemplazó los párrafos explicativos en 8 pantallas.
- Chevron en las filas tocables (Inicio, detalle de elemento, Movimientos);
  puntos de color por agrupación en la lista del Inicio (`colorCategoria`).

### Fase 18 — Acciones y explicaciones

- **`FAB`** (`ui/index.tsx`) + prop `<Screen fab={...}>`: botón flotante fijo
  abajo a la derecha (despeja la barra de tabs). "+" para "Registrar
  movimiento" en Inicio y Movimientos.
- **`EditarElementoScreen`**: nuevo toggle "¿Cuenta en el patrimonio del
  hogar?" → `CambiarParticipacionEnConsolidacion`; la visibilidad ahora lleva
  su `Ayuda`.
- **`AgregarElementoScreen`**: `Ayuda` bajo el selector de categoría funcional
  con el ejemplo de la opción elegida.
- `MoneyText` en el patrimonio neto del Inicio (rojo si negativo).

### Fase 19 — Carga y pickers

- **`Skeleton`** (`ui/index.tsx`): tarjetas grises con pulso (`Animated`);
  reemplazó el `ActivityIndicator` centrado en 9 pantallas de lista.
- **B7**: campo "Buscar elemento" sobre los pickers de origen / destino en
  "Registrar movimiento", visible solo con > 6 elementos.
- Barra de **avance total** en la lista de Objetivos (suma de los activos).
- Fix iPhone: `Screen` exige `HeaderHeightContext > 0` para considerar que hay
  header (el native-stack lo expone con 0 aunque esté oculto) — así las
  pantallas de tab vuelven a padear `24 + safe-area-top` y el título no queda
  bajo el notch. Mismo arreglo para la posición del `FAB`.

### Decisiones que fueron provisionales (ya cerradas)

- "Registrar movimiento" solo listaba tus propios elementos como destino. Desde
  la Fase 34 (GAPS.md G6, §B1) también lista los elementos de los co-miembros del
  hogar cuya existencia puedes ver (`GET /elementos-patrimoniales?alcance=hogar`).

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
