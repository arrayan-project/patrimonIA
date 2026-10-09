# Mejora visual pantalla por pantalla (S02)

**Objetivo de este archivo:** inventario de todas las pantallas de la app con
las acciones que hace el usuario en cada una, y el registro de la revisión
visual pantalla por pantalla (G35 en `GAPS.md`). Es la fuente de verdad de
este frente.

**Por qué (Juan, 2026-10-09):** después de G33 la interfaz mejoró, pero sigue
sin ser amigable: se siente demasiado corporativa. Se ataca pantalla por
pantalla, **solo en lo visual**.

## 1. Alcance y reglas

- **Visual y textos:** colores, tipografía, íconos, espaciado, forma de las
  tarjetas y botones, jerarquía y orden de lo que se ve. **No** cambian el
  dominio, el backend, los comandos ni los flujos (qué pasos tiene cada
  formulario, a dónde lleva cada botón).
- **Textos: entran** (V-2). Títulos, etiquetas, preguntas y estados vacíos se
  revisan junto con lo visual: "Registrar ajuste patrimonial" o "Tipos de
  elemento patrimonial" pesan tanto como los colores en la sensación de
  "corporativo". Lo que no cambia es qué hace cada pantalla.
- **Criterio:** claro, simple y amigable para el usuario final; pesa más que lo
  validado en el prototipo de la Fase D o en las plantillas
  (`prototipo/plantillas-pantalla-s01.html`). Las reglas de estructura de las
  plantillas (una cifra protagonista, subcifras que cuadran, una acción
  principal) siguen vigentes salvo que la revisión de una pantalla decida otra
  cosa, y se anota acá.
- **Cómo se trabaja una pantalla:** Claude describe cómo está hoy (con
  captura), propone qué mejorar, Juan decide, se implementa en una rama, Juan
  la prueba en el teléfono y se mergea. Se registra en la ficha de la pantalla
  (§6).
- **Referencia visual:** hasta que Juan elija la dirección del Paso 0 (§2),
  sigue vigente `prototipo/prototipo-fase-d-s01.html` (`CLAUDE.md`). Cuando se
  elija, se actualiza `CLAUDE.md` para que la nueva dirección sea la
  referencia.

## 2. Orden de trabajo

1. **Paso 0: dirección visual.** La mayor parte de la apariencia vive en las
   piezas comunes (`app/src/ui/index.tsx`, ≈2.650 líneas) y en `ui/tema.ts`
   (paleta, tipografía, radios). Si se mejora pantalla por pantalla sin una
   dirección común, cada una termina distinta y se rehacen varias veces. Por
   eso primero se define qué es "amigable" para PatrimonIA (paleta, tipografía,
   íconos, forma de tarjetas y botones, tono de las ilustraciones o estados
   vacíos) con 2 o 3 variantes probadas sobre el **Inicio**, Juan elige una y
   se aplica a las piezas comunes. Eso cambia toda la app de una vez.
2. **Pantalla por pantalla**, en el orden de las tandas del §5 (de lo que más
   se usa a lo que menos). Cada pantalla ajusta lo suyo sobre la dirección ya
   elegida.

Nota técnica: `ui/index.tsx` ya tiene una escala de espacios (`escala`, xs a
xxl) pero casi no se usa (≈130 números fijos en `ui/` y ≈40 en `screens/`).
Pasarlos a la escala se hace dentro del Paso 0, cuando se toquen esas piezas.

## 3. Mapa de la app

- **Sin sesión:** Login · Registro · Recuperar contraseña.
- **Primer uso (sin hogar):** Bienvenida → Crear hogar o Invitaciones.
- **Barra inferior (4 pestañas):** Inicio · Movimientos · Planificar · Hogar.
  Arriba a la derecha en las pestañas: campana (Notificaciones) y engranaje
  (Ajustes).
- **Botón "+" (Inicio y Movimientos):** hoja "¿Qué quieres anotar?" con Gasté ·
  Recibí · Moví plata · Ahorrar para una meta · Pagar tarjeta (si hay
  tarjetas) · Agregar cuenta.
- **Pantallas apiladas:** 49, con barra superior (título + atrás).
- **Total: 60 pantallas** (más la hoja del "+", que es una pieza común).

## 4. Decisiones del frente

| # | Decisión | Estado |
|---|----------|--------|
| V-1 | Primero la dirección visual común (Paso 0) y después pantalla por pantalla. | ✅ Juan, 2026-10-09 |
| V-2 | Los textos (títulos, etiquetas, preguntas, estados vacíos) entran en la revisión. | ✅ Juan, 2026-10-09 |
| V-3 | Se mergea a medida que cada cambio queda probado: el mes de la señal de Zoily (G33) todavía no empieza. | ✅ Juan, 2026-10-09 |

## 5. Inventario: pantallas y acciones

Formato: **Título visible** (`Archivo`) — de dónde se llega — acciones del
usuario. Las confirmaciones ("Eliminar…", "Desactivar…") abren la pantalla
común **Confirmar** (`AccionForm`), que pide el motivo cuando corresponde.

### Tanda 1 · Lo de todos los días

1. ✅ **Inicio** (`DashboardScreen`, rediseñado en el Paso 0, §6) — pestaña. Elegir hogar (si hay varios);
   ver "Mi patrimonio" con Liquidez, Guardado para metas, De otras personas y
   Libre para gastar; abrir una cuenta; ver Flujo del mes; ver Metas y abrir
   una o crear la primera; Accesos rápidos (Movimiento, Ahorrar, Programados);
   alertas (presupuesto excedido, deudas en mora, solicitudes por pagar);
   estado vacío "Agrega tu primera cuenta o bien"; botón "+"; campana;
   engranaje.
2. ✅ **Hoja "¿Qué quieres anotar?"** (`hooks/useAnotar`, §6) — botón "+". Gasté ·
   Recibí · Moví plata · Ahorrar para una meta · Pagar tarjeta · Agregar
   cuenta.
3. ✅ **Registrar movimiento** (`RegistrarMovimientoScreen`, §6; título según el
   tipo: Gasté / Recibí / Moví plata / Pagar tarjeta) — hoja "+", Hogar,
   Frecuentes. Elegir un frecuente; monto; cuenta; categoría (y crear una
   nueva); fecha; detalle y etiquetas opcionales; "¿De quién es?" (Mío / de
   otra persona, y crear persona); compartir un gasto con el hogar (la mitad u
   otro monto, con quiénes, a qué cuenta te transfieren); recibir de alguien
   del hogar o "Avisarle a [miembro]" si no aparece; sacar de una meta; "¿Se
   repite?" (cada mes o año); guardar.
4. ✅ **Movimientos** (`MovimientosScreen`, §6) — pestaña. Período Mes / Año /
   Recientes y flechas para moverse; Míos / Del hogar; balance del período;
   gráfico ingresos vs. gastos por mes; gastos e ingresos por rubro y filtrar
   por uno; lista por fecha; abrir un movimiento; botón "+".
5. ✅ **Movimiento** (`MovimientoDetalleScreen`, §6) — Movimientos, cuenta, Hogar.
   Ver datos (fecha, cuentas, categoría, detalle, efecto en la cuenta); ir a
   la cuenta, a la categoría o al presupuesto del mes; Editar (→ Editar
   movimiento); Guardar como frecuente; Eliminar movimiento.
6. ✅ **Editar movimiento** (`CorregirMovimientoScreen`, §6) — Movimiento. Cambiar
   monto, detalle y etiquetas; motivo de la corrección; guardar.

### Tanda 2 · Mi plata y mis cuentas

7. ✅ **Tu plata** (`PatrimonioSeccionScreen`, antes "Mi patrimonio", §6) — Inicio. Lista de cuentas y
   bienes por categoría; gráfico del último año; "Consultar otra fecha o
   período"; abrir una cuenta; Agregar cuenta o bien.
8. ✅ **¿Cómo ha cambiado tu plata?** (`EvolucionPatrimonioScreen`, antes
   "Evolución de mi patrimonio", §6) — Tu plata. Elegir período; ver la evolución y el total en otras monedas.
9. ✅ **Agregar cuenta o bien** (`AgregarElementoScreen`, §6) — hoja "+", Tu
   plata, Inicio vacío. Qué es; tipo (y crear uno nuevo); nombre;
   moneda; de quién es; desde cuándo; cuota y vencimiento (deudas); si se
   valoriza; después de crear: qué compartes con el hogar (o "Ahora no").
10. ✅ **Detalle de cuenta** (`ElementoDetalleScreen`, título "Detalle") —
    Inicio, Mi patrimonio, Hogar, Movimiento. Ver valor vigente, libre para
    gastar, en metas, datos (tipo, desde, cuota, tasa, saldo pendiente);
    movimientos, valorizaciones, ajustes y ahorros de la cuenta (abrir cada
    uno); Registrar valorización; Registrar interés / ajuste; "¿Cuánto valía
    en otra fecha?"; Ajustes de la cuenta; Editar; Historial de cambios;
    Desactivar / Reactivar; Condonar deuda o Declarar incobrable; Eliminar.
11. ✅ **Editar** (`EditarElementoScreen`) — Detalle de cuenta. Nombre, tipo,
    fechas, cuota, tasa, notas, dueño; marcar como corrección y por qué;
    guardar cambios.
12. ✅ **Ajustes de la cuenta** (`AjustesElementoScreen`) — Detalle de cuenta.
    Qué compartes con el hogar (y con quiénes, avanzado); si suma al
    patrimonio del hogar; si su valor cambia con el tiempo.
13. ✅ **Actualizar cuánto vale** (`ValorizarScreen`, antes "Registrar valorización", §6) — Detalle de cuenta.
    Cuánto vale y a qué fecha; guardar.
14. ✅ **Cambio de valor** (`ValorizacionDetalleScreen`, antes "Valorización", §6) — Detalle de cuenta. Ver
    valor, antes, fecha, estado; Corregir (→ Corregir); Eliminar valorización.
15. ✅ **Corregir el saldo / Sumar intereses** (`RegistrarAjusteScreen`, antes "Registrar ajuste patrimonial", §6) — Detalle de
    cuenta. Si el valor real es menor o mayor; monto; por qué; guardar.
16. ✅ **Corrección de saldo** (`AjusteDetalleScreen`, antes "Ajuste patrimonial", §6) — Detalle de cuenta. Ver
    motivo, fecha, estado; Corregir; Eliminar ajuste.
17. ✅ **Corregir** (`CorreccionFormScreen`) — Valorización, Ajuste. Nuevo valor;
    por qué; guardar corrección.
18. ✅ **¿Cuánto valía antes?** (`ValorEnFechaScreen`, antes "Valor en otra fecha", §6) — Detalle de cuenta. Elegir
    fecha; consultar.
19. ✅ **Historial de cambios** (`HistorialScreen`) — Detalle de cuenta, Meta,
    Ahorro. Leer los cambios (sin acciones).

### Tanda 3 · Planificar

20. ✅ **Planificar** (`PlanificarScreen`) — pestaña. Resumen de metas y ahorro
    sin meta; presupuesto del mes; accesos a Metas, Presupuestos, Movimientos
    programados y Frecuentes; abrir una meta o el presupuesto; crear la
    primera meta; campana; engranaje.
21. ✅ **Metas** (`ObjetivosScreen`) — Planificar, Inicio. Lista de metas; abrir
    una; Nueva meta; Ahorrar.
22. ✅ **Meta** (`ObjetivoDetalleScreen`) — Metas, Inicio, Planificar, Hogar. Ver
    avance (llevas, faltan, %); dónde está la plata (abrir cada parte);
    Aportar a esta meta; Usar plata de la meta; Agregar parte; Editar;
    Historial; Eliminar meta.
23. ✅ **Nueva meta / Editar meta** (`MetaFormScreen`) — Metas, Planificar,
    Inicio, Ahorrar. Nombre; cuánto juntar; moneda; compartir con el hogar;
    quién más puede modificarla; estado (al editar); guardar.
24. ✅ **Ahorrar para una meta** (`AhorrarScreen`) — hoja "+", Inicio, Metas,
    Meta, Ahorro. Para qué meta (o crear una); para qué parte; en qué cuenta
    está la plata; cuánto (o "Todo lo libre"); sumar otra cuenta o quitarla;
    guardar.
25. ✅ **Ahorro sin meta** (`AsignacionesScreen`) — Planificar. Lista; abrir uno;
    crear una meta.
26. ✅ **Ahorro** (`AsignacionDetalleScreen`) — Meta, Ahorro sin meta, Detalle de
    cuenta. Ver ahorrado y en qué cuentas; Ahorrar; Sacar; Historial;
    Eliminar esta parte / este ahorro.
27. ✅ **Sacar** (`SacarPlataScreen`) — Ahorro. De qué cuenta; cuánto; por qué;
    guardar.
28. ✅ **Presupuestos** (`PresupuestosScreen`) — Planificar. Lista; abrir uno;
    Nuevo presupuesto.
29. ✅ **Presupuesto** (`PresupuestoDetalleScreen`) — Presupuestos, Inicio,
    Planificar, Movimiento. Ver presupuesto vs. gastado, ingresos, ahorro, por
    rubro, ahorro por meta y sin clasificar; ir a los movimientos de un rubro;
    Editar; Editar rubros; Cerrar presupuesto; Eliminar presupuesto.
30. ✅ **Nuevo presupuesto / Editar** (`PresupuestoFormScreen`) — Presupuestos,
    Presupuesto. Solo tuyo o del hogar; cada cuánto; cuánto gastar; ingresos
    y ahorro esperados (opcional); moneda; desde / hasta; guardar.
31. ✅ **Presupuesto por rubro** (`PresupuestoRubrosScreen`) — Presupuesto. Monto
    por categoría y ahorro por meta; guardar rubros.
31b. ✅ **Gastos de una categoría** (`GastosCategoriaScreen`, nueva en G35) —
    Presupuesto. Ver cuánto pensabas, llevas y quedan; los gastos de esa
    categoría en el período; abrir uno.
32. ✅ **Movimientos programados** (`MovimientosProgramadosScreen`) — Planificar,
    Inicio. Lista; abrir uno; Programar movimiento.
33. ✅ **Programar movimiento** (`NuevoProgramadoScreen`) — Movimientos
    programados. Tipo; cuánto; cuentas; categoría; fecha; detalle; "¿Se
    repite?"; guardar.
34. ✅ **Movimiento programado** (`MovimientoProgramadoDetalleScreen`) —
    Movimientos programados, aviso "¿Se pagó?". Ver datos y si se repite;
    Confirmar pago; Cambiar monto; ver el movimiento generado; ir a la
    cuenta; Editar; Dejar de repetir; Cancelar movimiento.
35. ✅ **Editar programado / Confirmar pago** (`ProgramadoFormScreen`) —
    Movimiento programado. Monto y fecha ("¿Para cuándo?" o "¿Cuándo se
    pagó?"); guardar.
36. ✅ **Frecuentes** (`PlantillasScreen`) — Planificar, Ajustes. Lista y
    buscador; abrir uno; Nuevo frecuente.
37. ✅ **Nuevo frecuente / Editar** (`PlantillaFormScreen`) — Frecuentes,
    Movimiento. Nombre; tipo; cuánto; cuentas; categoría; detalle; guardar;
    Eliminar frecuente.

### Tanda 4 · Hogar  ✅ (completa, 2026-10-09)

38. ✅ **Hogar** (`HogarScreen`) — pestaña. Plata del hogar (Tienen / Deben);
    lo que suma al hogar (abrir cada cuenta); metas del hogar; "Entre
    [miembro] y tú"; Para transferir (→ Registrar movimiento); Personas;
    invitaciones recibidas; Más del hogar (Patrimonio del hogar, Movimientos
    del hogar, Gestionar hogar); campana; engranaje.
39. ✅ **Patrimonio del hogar** (`HogarConsolidadoScreen`) — Hogar. Ver Tienen /
    Deben, plata y metas del hogar por moneda (sin acciones).
40. ✅ **Movimientos del hogar** (`MovimientosHogarScreen`) — Hogar. Lista por
    mes; abrir un movimiento.
41. ✅ **Entre ustedes** (`EntreMiembrosScreen`) — Hogar. Lista de solicitudes y
    transferencias entre dos miembros; abrir un movimiento; pagar una
    solicitud.
42. ✅ **Pagar** (`PagarSolicitudScreen`) — Inicio, Entre ustedes,
    Notificaciones. Ver cuánto y a qué cuenta; Transferir (desde qué cuenta);
    No me corresponde.
43. ✅ **Personas del hogar** (antes "Gestionar hogar", `GestionHogarScreen`) — Hogar, Ajustes. Nombre;
    moneda del total; miembros (cambiar rol, Remover); Invitar a alguien;
    Salir del hogar; Eliminar hogar.

### Tanda 5 · Avisos, ajustes y cuenta  ✅ (completa, 2026-10-09)

44. ✅ **Notificaciones** (`NotificacionesScreen`) — campana. Lista de avisos;
    abrir uno (marca leído y lleva a su pantalla); marcar todos como leídos.
45. ✅ **Ajustes** (`AjustesScreen`, revisado 2026-10-09, §6) — engranaje. Tu cuenta (Mi perfil, Cerrar
    sesión); Cómo se ve (Tema, Fechas, Moneda principal en Inicio, Secciones
    del Inicio); Avisos; Hogar (Gestionar hogar, Invitaciones); Tus datos
    (Categorías, Etiquetas, Agrupaciones, Frecuentes, Tipos de cuenta o bien,
    Tipos de cambio).
46. ✅ **Secciones del Inicio** (`AjustesVisualizacionScreen`) — Ajustes.
    Mostrar u ocultar cada sección; Mostrar todas.
47. ✅ **Mi perfil** (`PerfilScreen`) — Ajustes. Nombre y correo; Desactivar mi
    cuenta.
48. ✅ **Categorías de movimiento** (`CategoriasScreen`) — Ajustes. Lista y
    buscador; ordenar (subir / bajar); abrir una; Nueva categoría.
49. ✅ **Etiquetas** (`EtiquetasScreen`) — Ajustes. Lista y buscador; abrir una;
    Nueva etiqueta.
50. ✅ **Mis grupos** (antes Agrupaciones; se usan en Tu plata, §6) (`AgrupacionesScreen`) — Ajustes y Tu plata. Lista y buscador; abrir
    uno; Nuevo grupo.
51. ✅ **Tipos de elemento patrimonial** (`TiposElementoScreen`) — Ajustes. Lista
    y buscador; ordenar; abrir uno; Nuevo tipo.
52. ✅ **Tipos de cambio** (`TiposCambioScreen`) — Ajustes. Lista de tasas y
    buscador; Registrar tasa.
53. ✅ **Nuevo / Editar (catálogo)** (`CatalogoFormScreen`) — las cinco
    anteriores. Según el catálogo: nombre, categoría padre, para qué
    movimientos, categoría sugerida, cuentas dentro de una agrupación, monedas
    y tasa; guardar; Archivar o Eliminar.
54. ✅ **Confirmar** (`AccionFormScreen`, título según la acción) — Detalles,
    Gestionar hogar, Mi perfil. Motivo o dato que pide la acción (Eliminar,
    Desactivar, Remover, Invitar, Cerrar presupuesto, Dejar de repetir…);
    confirmar.

### Tanda 6 · Acceso y primer uso  ✅ (completa, 2026-10-09)

55. ✅ **Login** (`LoginScreen`) — Email; contraseña; Entrar; ¿Olvidaste tu
    contraseña?; registrarme.
56. ✅ **Registro** (`RegistroScreen`) — Nombre, email, contraseña; Crear cuenta;
    código de registro; Confirmar registro; volver; ya tengo cuenta.
57. ✅ **Recuperar contraseña** (`RecuperarPasswordScreen`) — Email; Enviar
    código; código; nueva contraseña; Cambiar contraseña; volver a pedirlo;
    volver a iniciar sesión.
58. ✅ **Bienvenido** (`BienvenidaScreen`) — sin hogar. Crear un hogar nuevo;
    Tengo una invitación pendiente; Cerrar sesión.
59. ✅ **Crear hogar** (`CrearHogarScreen`) — Bienvenida. Nombre; moneda del
    total; crear hogar.
60. ✅ **Invitaciones pendientes** (`InvitacionesScreen`) — Bienvenida, Hogar,
    Ajustes. Aceptar; Rechazar.

(La hoja del "+", ítem 2, no es una pantalla, y Gastos de una categoría
(31b) se agregó en G35: la numeración llega a 60 con 60 pantallas.)

## 6. Fichas de revisión

Una ficha por pantalla, en el orden en que se trabajen. Plantilla:

```
### <n>. <Título> (`<Archivo>`)  ⬜ / 🟡 / ✅
- **Cómo se ve hoy:** estructura, jerarquía, colores, piezas que usa (captura).
- **Qué la hace poco amigable:** …
- **Propuesta:** …
- **Decisión de Juan:** … (fecha)
- **Rama y estado:** `feat/G35-…` · probada / mergeada (fecha)
```

### Paso 0 · Dirección visual  ✅ (probado por Juan y mergeado, 2026-10-09)

- **Cómo se ve hoy:** monocromo de alto contraste (blanco, negro y grises de
  `ui/tema.ts`); el color solo aparece en los montos (verde/rojo). Títulos de
  sección en mayúsculas chicas, tarjetas grises iguales, íconos de línea
  (Ionicons outline), letra del sistema. Palabras de banco: patrimonio,
  liquidez, flujo, balance.
- **Propuestas, ronda 1 (2026-10-09):** [`prototipo/direccion-visual-s02.html`](prototipo/direccion-visual-s02.html),
  el Inicio de hoy junto a tres direcciones con los mismos datos y los mismos
  textos nuevos, en claro y oscuro:
  - **A · Colores con significado:** cada tema con su color (cuentas azul,
    inversiones verde, deudas rojo, metas ámbar), letra redondeada (Nunito),
    cifra principal en una tarjeta de color.
  - **B · Calma:** un solo acento verde salvia, fondo apenas verdoso, cifra
    sobre el fondo sin caja, tarjetas blancas con sombra suave (Figtree).
  - **C · Con personalidad:** amarillo y negro, bordes marcados con sombra
    sólida, títulos con carácter (Bricolage Grotesque + Nunito).
  - **Textos** (iguales en las tres): tabla al pie del documento HTML.
- **Ronda 1 (A, B, C): descartada por Juan** (2026-10-09): no le gustó
  ninguna. Solo cambiaban colores y letra sobre la misma estructura. En el
  archivo se reemplazaron por la ronda 2.
- **Ronda 2 (2026-10-09), mismo archivo:** cambian también el orden y la forma
  de mostrar las cosas:
  - **D · Conversación:** la pantalla habla en frases ("Este mes puedes gastar
    $860.000" y de dónde sale), botones grandes Gasté / Recibí / Ahorrar
    (Lexend).
  - **E · Billetera:** cada cuenta es una tarjeta de color deslizable; las
    metas son frascos que se llenan (Outfit).
  - **F · Suave:** pastel y redondo; "Puedes gastar" como anillo, cifras en
    burbujas de color, metas como anillos de avance (Baloo 2 + Nunito Sans).
- **Textos: aprobados por Juan** (2026-10-09), los de la tabla del HTML.
- **Ronda 3 · la mezcla (Juan, 2026-10-09)**, mismo archivo (Hoy junto a la
  propuesta, interactiva):
  - **Resumen:** el de hoy (cifra total con Tienes / Debes y la resta Plata
    disponible − Guardado para metas − De otras personas = Puedes gastar), con
    los textos aprobados: explica bien de dónde salen los montos.
  - **Cuentas como tarjetas de color deslizables** (de E): se muestran 3 y una
    tarjeta "Ver todas". **Cambia el comportamiento:** al tocar una tarjeta
    aparecen debajo, en el mismo Inicio, sus movimientos del mes (por defecto),
    con un interruptor para ver los de esa cuenta o los de todas las cuentas
    en el período; "Ver todos los movimientos" lleva a Movimientos. Hoy, tocar
    una cuenta abre su detalle.
  - **Metas en anillo** (de F): solo las 2 con más avance; el resto en "Ver
    todas".
  - **Selector "Lo mío / Del hogar"** con los colores de F; la paleta y la
    letra de toda la propuesta también son las de F (lila y pastel, Baloo 2 +
    Nunito Sans).
  - Quedan fuera los "Atajos" (Accesos rápidos): el "+" ya cubre anotar.
  - **Emojis (Juan, 2026-10-09: "sí o sí")**: dan personalidad y permiten
    reconocer de un vistazo qué es cada fila. De dónde sale cada uno:
    - **Categorías de movimiento** (🛒 Mercado, 🏠 Vivienda, 💡 Servicios, 🚗
      Transporte…): la columna `categoria_movimiento.icono` ya existe y la app
      no la usa, así que **no hace falta migración**. Se agrega un emoji a
      `CATEGORIAS_DEFAULT`, se completa el de las categorías ya creadas
      (script de datos por nombre) y el formulario de categoría permite
      elegirlo.
    - **Cuentas y bienes** (🏦 💵 📈 💳 🏠 🤝): según su categoría fija
      (liquidez, inversión, bien, deuda, crédito), en la app. Sin migración.
    - **Metas** (🏖️ 🛟): para que cada usuario elija el suyo hace falta una
      columna nueva (`objetivo_financiero.icono`, migración). Sin ella, todas
      llevan el mismo (🎯). 📋 Juan.
    - **Filas fijas** (resumen y "Así va el mes": 💵 🐷 👥 ✅ 📥 📤 🎉): en la
      app.
    - Son los emojis del teléfono: se ven distintos en iPhone y Android, y no
      requieren dependencia.
- **Costo común:** una letra propia requiere agregar un paquete de fuentes a
  la app (dependencia nueva, se pide visto bueno al implementar).
- **Decisiones de Juan (2026-10-09), para implementar:**
  - Emojis por defecto y **configurables por elemento**. Categorías de
    movimiento: en `categoria_movimiento.icono` (del hogar, sin migración).
    Cuentas y metas: en `usuario.preferencias.visualizacion.emojis` (personal,
    sin migración ni backend).
  - Letra armónica que no sature: **una sola familia, Nunito** (400 a 900),
    redondeada y tranquila; reemplaza la propuesta Baloo 2 + Nunito Sans.
  - Movimientos debajo de las tarjetas: **solo 4 filas**; el resto en la
    pestaña Movimientos. Los Atajos siguen y se muestran u ocultan desde
    Ajustes › Secciones del Inicio (G25).
- **Implementado (2026-10-09), rama `feat/G35-P0-inicio`:**
  - Base común: paleta lila y pastel en `ui/tema.ts` (claro y oscuro, con
    `acentoSuave`, `heroA`/`heroB` y colores de tarjeta); radios más
    redondeados; títulos de sección sin mayúsculas. Letra Nunito
    (`@expo-google-fonts/nunito`, dependencia nueva aprobada) con `ui/Text`,
    que traduce `fontWeight` al archivo de la letra (en Android `fontWeight`
    no elige el archivo). Barra de pestañas y títulos con la letra y el acento.
  - Piezas comunes: `Hero` con degradado y parte blanca (`debajo`),
    `AnilloAvance`, `ElegirEmoji` (grilla de 40 emojis más uno escrito),
    `TxRow` con emoji, selector y atajos con el acento. Como son comunes, el
    cambio de color y letra se ve en toda la app.
  - Inicio: saludo con fecha; selector "Lo mío / Del hogar"; avisos con
    emoji; resumen de siempre con los textos aprobados; tarjetas de cuenta
    (3 + "Ver todas", color por posición, emoji); al tocar una, sus 4
    movimientos del mes, con interruptor para ver los de todas las cuentas,
    "Ver la cuenta" y "Ver todos los movimientos"; metas en anillo (las 2 con
    más avance); "Así va [mes]" ("Gastaste de más" si el balance es negativo);
    Atajos. En "Del hogar" se mantiene la lista por categoría, con emojis.
  - Elegir emoji: formulario de categoría, Ajustes de la cuenta ("Cómo se
    ve") y formulario de la meta.
  - Verificado: `tsc` sin errores, tests de `app/src` verdes, capturas web
    del Inicio en claro y oscuro (tarjetas, interruptor, metas).
- **Prueba de Juan (2026-10-09):** el Inicio quedó bien. Un ajuste: la
  última fila del resumen ("Puedes gastar") tenía línea debajo; `Datos plano`
  ahora la recorta como `ListCard`. Mergeado a `main`.
- **Validación de las acciones del Inicio (2026-10-09, a pedido de Juan):**
  se recorrieron las 18 acciones (campana, Ajustes, avisos, tarjeta del
  total, tarjetas de cuenta, "Ver la cuenta", filas de movimiento, "Ver
  todos los movimientos", metas, "Ver todas", "Así va", 4 atajos, "+" y
  "Del hogar"): todas llevan a su destino. Las pantallas de destino ya tienen
  colores y letra nuevos, pero no los textos ni los emojis (llegan en sus
  tandas). Ajustes hechos en el Inicio (rama `feat/G35-P0b-inicio-tocables`):
  - Toda zona tocable mide al menos 44 px: enlaces "Ver todas" / "Ver todo" y
    "Ver la cuenta" (relleno compensado con margen negativo, porque `hitSlop`
    no aplica en web), selector "Lo mío / Del hogar", campana y engranaje, y
    un área alrededor del interruptor de movimientos.
  - Cuentas: un solo "Ver todas" (la última tarjeta del carrusel); se quitó
    el enlace del título. La tarjeta del total sigue llevando a Mi patrimonio
    (Juan: se conserva por ahora).
  - "Del hogar": categorías sin jerga (Cuentas, Ahorro, Inversiones, Bienes,
    Te deben, Deudas) y "N% del total".
  - "Lo mío / Del hogar" también en Movimientos (antes "Míos").
- **Pulido final del Inicio (2026-10-09, rama `feat/G35-P0c-inicio-pulido`):**
  sin la fila "N avisos sin leer" (la campana ya los cuenta; arriba solo
  queda lo que pide algo); en "Del hogar", "Metas del hogar" con solo las
  metas compartidas; porcentaje con coma ("59,4%"); el aviso de total
  parcial dice "Este total no incluye la plata en USD: falta su valor en
  CLP". La tarjeta del total sigue llevando a Mi patrimonio sin señal
  visible (Juan: por ahora).
- **Orden (Juan, 2026-10-09):** después del Inicio sigue **Ajustes** (ítem
  45), adelantado desde la tanda 5: es lo segundo que se abre desde el Inicio
  y lleva a los catálogos.

### 45. Ajustes (`AjustesScreen`)  ✅ (aprobado por Juan y mergeado, 2026-10-09)

- **Cómo se veía:** cinco grupos (Tu cuenta, Hogar, Cómo se ve, Avisos, Tus
  datos), íconos de línea grises iguales, "Mi perfil · Nombre y correo" sin
  decir quién eres, "Tus datos" con jerga sin explicar ("Tipos de cuenta o
  bien", "Agrupaciones", "Tipos de cambio") y en desorden; en "Cómo se ve",
  tres tipos de control con títulos chicos y botones de opción de 40 px.
- **Propuesta aprobada por Juan (2026-10-09) e implementada** (rama
  `feat/G35-P0c-inicio-pulido`, junto con el pulido del Inicio):
  - Tarjeta tuya arriba (inicial en círculo lila, nombre, correo, "🏠 hogar ·
    N personas"); abre Mi perfil. Reemplaza "Tu cuenta".
  - Emoji por fila (`MenuList` e `Interruptor` aceptan `emoji`): 🏠 ✉️ 🎨 📅
    💱 🧩, avisos 🎉 🐷 ✉️.
  - "Tus datos" pasa a "Para ordenar tu plata", por uso y con una línea que
    dice para qué sirve cada uno: ⚡ Frecuentes, 🏷️ Categorías, 💼 Tipos de
    cuenta, 🔖 Etiquetas, 🗂️ Agrupaciones, 💵 Tipos de cambio. Los títulos de
    esas pantallas coinciden ("Categorías", "Tipos de cuenta").
  - Botones de opción (`Segmented`) de 44 px en toda la app; círculo del
    interruptor blanco en ambos temas (y en web, que lo pintaba verde).
- **Verificado:** `tsc` sin errores; capturas web en claro y oscuro; las 10
  filas abren su pantalla; toda zona tocable ≥ 44 px (el dibujo del
  interruptor mide 40×20, pero se toca la fila completa, de 62 px).
- **Ajustes de Juan (2026-10-09):**
  - Los botones de opción de ancho distinto se veían desordenados:
    `Segmented` pasa a ser un solo control con las opciones del mismo ancho
    (fondo suave, la elegida en lila). Es pieza común: aplica en toda la app
    (Tema, Fechas, Mes/Año/Recientes, Sí/No de los formularios…).
  - Las pantallas de "Para ordenar tu plata" seguían con íconos genéricos:
    ahora usan emojis en filas y estados vacíos. Categorías: el de cada
    categoría; Frecuentes: el de su categoría o el de su tipo; Tipos de
    cuenta: el de su categoría sugerida; Etiquetas 🔖 y Agrupaciones 🗂️ sobre
    su color suave; Tipos de cambio: el de la moneda (`emojiMoneda`).
- **Aprobado por Juan y mergeado a `main` (2026-10-09)**, junto con el pulido
  final del Inicio.

### 36–37, 48–53. Para ordenar tu plata (catálogos de Ajustes)  ✅ (probado por Juan y mergeado, 2026-10-09)

Juan (2026-10-09): si se ataca una pantalla, se cubren todos sus puntos; por
eso entran las 6 listas y sus formularios de crear y editar.

- **Cómo se veían:** flechas ▲▼ de 18×20 px en todas las filas de Categorías
  (24) y Tipos de cuenta (32); ayudas con otras palabras que Ajustes; "Archivar";
  Tipos de cuenta con grupos "Liquidez", "Ahorro / fondo de emergencia",
  "Activo" y la pregunta "¿Qué categoría sugiere?", y el mismo emoji para
  todos los tipos de un grupo; en Categorías el emoji como fila suelta, "Ingresos
  y ga…" cortado y "Ninguna (categoría principal)"; en Frecuentes "¿De qué
  tipo?" para elegir una categoría; círculos de color de unos 30 px; tipos de
  cambio con el código de moneda escrito a mano y filas "USD → CLP · 960";
  Agrupaciones sin uso visible en ninguna pantalla.
- **Implementado (rama `feat/G35-ordenar-tu-plata`):**
  - Ordenar: botón "↕️ Cambiar orden" / "✓ Listo" (`ModoOrden`); las flechas
    solo aparecen al ordenar y miden 44 px (`Ordenar`).
  - Ayudas con las palabras de Ajustes; "Archivar" pasa a "Dejar de usar"
    (con su explicación y "Listo, ya no aparece").
  - Tipos de cuenta: grupos 🏦 Cuentas, 🐷 Ahorro, 📈 Inversiones, 🏠 Bienes,
    💳 Deudas, 🤝 Te deben (`NOMBRE_CATEGORIA_FUNCIONAL`, compartido con el
    Inicio); "¿Qué tipo de plata es?" con esas opciones y una línea que las
    explica; emoji propio por tipo según su nombre (`emojiTipoElemento`: 💵
    Efectivo, 📱 Billetera digital, ⏳ Depósito a plazo, 📊 Fondo mutuo, 🪙
    Criptomonedas, 🏡 Crédito hipotecario…), que también usan las tarjetas
    del Inicio.
  - Categorías: el emoji es un botón junto al nombre (`ElegirEmoji
    compacto`); "Gastos / Ingresos / Ambos"; "No, es una categoría principal".
  - Frecuentes: "¿De qué categoría?" con el emoji de cada una.
  - Etiquetas: círculos de color que se tocan en 44 px.
  - Tipos de cambio: monedas elegidas de una lista con emoji (incluye UF);
    filas "1 USD = 960 CLP · anotada por ti / se actualiza sola".
  - Agrupaciones fuera de Ajustes (los datos quedan). **Pendiente:** usarlas
    para agrupar cuentas en Mi patrimonio (Juan, 2026-10-09), cuando se
    revise esa pantalla. → **Hecho (Juan, 2026-10-09; rama
    `feat/G35-agrupaciones`, probada por Juan y mergeada):** se llaman **"Mis grupos"**. En Tu plata
    ("Lo mío"), si hay al menos uno, el selector "🏦 Por tipo · 🗂️ Mis
    grupos": cada grupo con su subtotal y sus cuentas, y "📦 Sin grupo" con
    el resto (los subtotales suman el total de arriba). Al final de Tu plata,
    la fila "🗂️ Armar mis grupos" (o "Mis grupos") abre la lista; también
    vuelve a Ajustes › Para ordenar tu plata ("🗂️ Mis grupos · Junta
    cuentas, como 'Jubilación'"). Lista, formulario y avisos dicen "grupo"
    ("🗂️ Nuevo grupo", "🗂️ ¿Cómo se llama el grupo?", "Ej.: Jubilación",
    "🏦 ¿Qué cuentas o bienes van dentro?", "Sus cuentas quedan sin grupo").
    Sin cambios en el backend. Dato de prueba local: grupo "Jubilación" de
    Demo (Cuenta de ahorro + Fondo mutuo Fintual).
- **Verificado:** `tsc` sin errores; capturas web de listas, modo ordenar y
  formularios; ninguna zona tocable bajo 44 px en Categorías (normal y
  ordenando), Tipos de cuenta y Nueva etiqueta.

### 2–3. Hoja "+" y Registrar movimiento (`useAnotar`, `RegistrarMovimientoScreen`)  ✅ (probado por Juan y mergeado, 2026-10-09)

- **Cómo se veían:** la hoja con seis filas iguales de íconos de línea (Gasté
  pesaba lo mismo que Agregar cuenta) y "Cancelar" como enlace de 19 px. El
  formulario, gris y numerado: el monto era un "0" con línea debajo, ninguna
  lista con emoji (las categorías como "› Nombre"), "¿De qué tipo?" (en
  Frecuentes ya decía "¿De qué categoría?"), cuatro enlaces subrayados de
  19 px ("+ Nueva categoría", "+ Agregar detalle", "+ Se repite…", "+ Agregar
  etiquetas") y Hoy / Ayer / Otra fecha de 30 px.
- **Propuesta aprobada por Juan (2026-10-09) e implementada** (rama
  `feat/G35-registrar`):
  - Hoja: Gasté 💸, Recibí 💰 y Moví plata 🔁 como tres tarjetas grandes de
    color (rosa, verde, celeste; `colorAnotar`); Ahorrar 🐷, Pagar tarjeta 💳
    y Agregar cuenta ➕ como filas con emoji; "Cancelar" como botón.
  - Formulario: el monto en una banda del color y con el emoji de su puerta
    (`MontoBanda`; 💳 en Pagar tarjeta, 💱 en cambio de moneda), con los
    Frecuentes dentro (`Pastilla` de 44 px con el emoji de su categoría).
  - Emojis en todas las listas (`OpcionSelect.emoji`, pieza común): de quién
    es (🙋 👫 👤 👥), cuentas (`opcionesDeElementos` / `opcionesDeMiembros`
    con `emojis`), categorías (las subcategorías dicen "Dentro de …"),
    personas, metas, "La mitad" / "Otro monto", etiquetas.
  - "¿De qué categoría?"; "➕ Nueva categoría" es la última opción de la
    lista.
  - Fecha con el control de opciones de 44 px (`Cuando`, pieza común:
    aplica en todos los formularios que la usan).
  - Opcionales como fila de botones 📝 Detalle · 🔁 Se repite · 🏷️ Etiquetas
    (`Opcionales`).
  - Pie: el resumen lleva el emoji de la puerta y el botón dice "Anotar
    gasto / ingreso / movimiento / cambio de moneda" ("Pagar tarjeta" en esa
    puerta).
  - "De alguien del hogar": filas con 👥.
  - "Cancelar" de las listas (`Select`) y de la hoja de emojis pasa a botón de 44 px en toda la app.
  - Hojas modales (Juan, 2026-10-09: el velo oscuro subía pegado a la
    lista, como una cortina): pieza común `HojaModal` para las cuatro hojas
    (listas, listas múltiples, "+", emojis). El velo aparece en su lugar y
    solo la hoja sube desde abajo; alto máximo 85% de la pantalla.
- **Frecuentes (Juan, 2026-10-09):** se probaron también en la hoja "+" y
  se quitaron de ahí: repetían lo del formulario y mezclaban los tres tipos.
  En la banda del formulario (opción C, elegida entre botones solos y un
  selector solo): los 3 primeros frecuentes de ese tipo (orden de Ajustes ›
  Frecuentes) a un toque y, si hay más, "Ver todos (N)", que abre la lista
  común (`Elegir` con `boton`) con emoji, monto y cuenta de cada uno. Los
  Frecuentes son las plantillas (D-6), no otro prellenado.
  Ajuste de Juan al verlo con datos (2026-10-09): título "⚡ Tus frecuentes
  (N)" (el número dice que no hay más que buscar), **2** a la vista para que
  la banda no crezca, y "🔍 Ver los N" distinto de los frecuentes (`Pastilla
  enlace`: sin relleno, borde punteado lila). Sin frecuentes de ese tipo:
  "⚡ Aún no tienes frecuentes de …" con "➕ Crear uno", que abre Nuevo
  frecuente con el tipo ya elegido (`PlantillaForm` acepta `tipo`); al
  volver, el formulario recarga sus frecuentes.
- **Verificado:** `tsc` sin errores; capturas web en claro y oscuro de la
  hoja, Gasté (vacío, lleno, cuentas, categorías, compartido, de otra
  persona), Recibí (de alguien del hogar), Moví plata y Pagar tarjeta;
  ninguna zona tocable bajo 44 px; con 5 frecuentes de gasto (simulados),
  2 a la vista + "🔍 Ver los 5"; sin frecuentes de
  ingreso, "Crear uno" abre Nuevo frecuente en Ingreso, y elegir uno desde la lista o desde un
  botón llena el formulario.

### 4–6. Movimientos, Movimiento y Editar movimiento (`MovimientosScreen`, `MovimientoDetalleScreen`, `CorregirMovimientoScreen`)  ✅ (probado por Juan y mergeado, 2026-10-09)

- **Cómo se veían:** tres filas de controles antes de cualquier cifra
  (Lo mío / Del hogar, ‹ mes ›, Mes / Año / Recientes) con flechas de menos de
  44 px; "Balance de octubre" con un "▼ 1.525.510 CLP" sin decir contra qué;
  "Libre para gastar · … de liquidez − …" como párrafo (repetía el Inicio);
  dona "Gastos por rubro" con la leyenda cortada ("S") y la cifra del centro
  en otra letra, sin poder tocarla; filtros "Todos / Ingresos / Gastos /
  Transferencias" de unos 30 px; lista plana con flechas iguales, la fecha en
  cada fila, "Gasto · Gasto" sin detalle y transferencias sin signo;
  "Cargar 3 meses más" como enlace de 13 px. El detalle: "Gasto" sin emoji,
  "Editar" cortado en el borde, enlaces subrayados, "Estado: Vigente",
  "Eliminar" como texto rojo y "Guardar como frecuente" como acción
  principal. Editar: pasos numerados, el monto como "0" con línea y "Una
  corrección queda enlazada al original".
- **Propuesta aprobada por Juan (2026-10-09) e implementada** (rama
  `feat/G35-movimientos`):
  - Período en una fila "‹ 🗓️ Octubre 2026 ›" con flechas de 44 px.
  - Resumen como el del Inicio: "Así va / Así fue [período]" con 📥 Te entró
    · 📤 Gastaste · 🎉 Te sobra (o ⚠️ Gastaste de más); en "Del hogar", Les
    entró · Gastaron · Les sobra. Debajo, en el mes, "▲/▼ X más/menos que en
    [mes anterior]". Sale "Libre para gastar" (está en el Inicio).
  - "¿En qué se fue?" reemplaza la dona: barras por categoría con emoji,
    monto y %, de mayor a menor, 4 a la vista y "Ver todas (N)". Tocar una
    filtra la lista (pastilla "🛒 Mercado ✕", la misma que al llegar desde un
    movimiento o un presupuesto). Es lo único nuevo en comportamiento.
  - "Tus movimientos" / "Movimientos del hogar": filtros Todo · 💸 Gasté ·
    💰 Recibí · 🔁 Moví en el control de opciones de 44 px; "🔍 Buscar" abre
    el campo (busca también por categoría).
  - Lista agrupada por día (Hoy, Ayer, "Lunes 5 de octubre"); cada fila con
    el emoji de su categoría o tipo, el detalle (o la categoría) de título, la
    categoría o "Entró a / Salió de / Entre tus cuentas" debajo, y el monto
    con signo (+ verde). El reporte no trae el nombre de la cuenta, por eso
    no aparece en la fila (cambiarlo es backend).
  - Año: "Mes a mes". Recientes: botón "⏬ Ver 3 meses más". Estado vacío
    con 🧾.
  - Movimiento: banda del color y emoji de su puerta ("💸 Gastaste 60.000
    CLP", "📅 8 de octubre de 2026 · Cuenta corriente", o "Origen → Destino"
    en una transferencia); cuentas, categoría y presupuesto del mes como filas
    tocables con emoji (`MenuList`); 📝 Detalle y "En esta cuenta" como datos;
    sin "Estado" (si se eliminó, aviso arriba); botones ✏️ Editar, ⚡ Guardar
    como frecuente y 🗑️ Eliminar movimiento. "Editar" sale de la barra
    superior.
  - Editar: nota "Puedes cambiar el monto, la fecha y el detalle…", monto en
    `MontoBanda` de su tipo, sin numerar, 📝 Detalle y 🏷️ Etiquetas como
    `Opcionales`, "¿Por qué lo cambias?" y "Guardar cambios".
  - `EMOJI_ANOTAR` (emoji de cada puerta) pasa a `emojis.ts`, compartido con
    Registrar.
- **Verificado:** `tsc` sin errores; capturas web de Mes, Año, Recientes,
  Del hogar, filtros, búsqueda, filtro por categoría, detalle de gasto y de
  transferencia, Editar y modo oscuro; la fila Categoría del detalle vuelve a
  Movimientos filtrada en el mes del movimiento; ninguna zona tocable bajo
  44 px en Movimientos ni en el detalle.
- **Arreglos después de la prueba de Juan (2026-10-09, rama
  `fix/G35-movimientos-fechas`):**
  - En Recientes, "Ver 3 meses más" mostraba en rojo "Falta ?desde=YYYY-MM-DD"
    al pasar al año anterior: la fecha se armaba como texto sin cambiar de año
    (`2026--1-01`). Ahora se calcula con el calendario (`iso`); esto también
    evita que la vista Mes de diciembre pidiera el mes 13. No hay límite hacia
    atrás.
  - Al abrir Movimientos, todas las consultas se hacían dos veces (guardar el
    hogar cambiaba la función de carga); el hogar queda en un `ref`.

### 7–9. Tu plata, ¿Cómo ha cambiado tu plata? y Agregar cuenta o bien (`PatrimonioSeccionScreen`, `EvolucionPatrimonioScreen`, `AgregarElementoScreen`)  ✅ (aprobado por Juan y mergeado, 2026-10-09)

- **Cómo se veían:** "Mi patrimonio" no había seguido al Inicio del Paso 0:
  "Tu patrimonio" donde el Inicio dice "Tu plata en total", grupos con jerga
  ("Liquidez", "Activo", "Ahorro / fondo de emergencia") e íconos de línea
  (todas las deudas con el mismo), filas "Cuenta corriente · Cuenta
  corriente", "Vigente" / "Parcialmente pagada" y "tuyo el 60% de 112.0…"
  cortado; el gráfico con "mín / máx" y el enlace subrayado "Consultar otra
  fecha o período ›"; "También hay elementos en USD." sin cifra. Evolución:
  "3M 6M 1A 3A", "▼ 46.892.490 CLP (59.4%)" con punto y "▲ 0 USD (0%)".
  Agregar: preguntas numeradas en gris, el monto como "0" con línea, dos
  enlaces subrayados, tipos sin emoji y "¿Qué tipo es?" dos veces.
- **Propuesta aprobada por Juan (2026-10-09) e implementada** (rama
  `feat/G35-tu-plata`):
  - **Tu plata** (título nuevo, igual que el Inicio y su acceso "Tu plata"):
    Hero "Tu plata en total" con 💰 Tienes y 💳 Debes (la misma cifra del
    Inicio) y, en la parte blanca, "💵 Además, en USD 2.500 USD" por cada otra
    moneda. "📈 Cómo ha cambiado" con "Ver más" (→ Evolución): el gráfico del
    año sin mín/máx y debajo la resta que cuadra, 🗓️ Hace un año → 📍 Hoy =
    📉 Bajó / 📈 Subió (`CambioPeriodo`, pieza común). No se repite la
    variación de 3 meses del Inicio: dos variaciones distintas en la misma
    pantalla confunden.
  - Grupos con emoji y nombre sin jerga (🏦 Cuentas · 🐷 Ahorro · 📈
    Inversiones · 🏠 Bienes · 🤝 Te deben · 💳 Deudas) y su subtotal; filas
    con el emoji de la cuenta (`emojiElemento`, como las tarjetas del Inicio);
    el tipo solo si no repite el nombre; "Tu parte: 60%"; el estado solo si
    pide algo ("⏰ En mora").
  - Cuentas desactivadas: "🗄️ Ver desactivadas (N)" al final, con sus filas
    ("… · Desactivada"). Antes no aparecían en ninguna parte de la app (la
    lista no pedía `incluirInactivos`), así que no había cómo llegar a
    Reactivar. No suman en ningún total.
  - "➕ Agregar cuenta o bien". La vista de un solo grupo (desde la
    composición del Inicio) usa las mismas filas; en Deudas / Te deben,
    "🏦 Con bancos y personas" y "📦 Encargos y plata de otros".
  - **¿Cómo ha cambiado tu plata?**: "3 meses · 6 meses · 1 año · 3 años";
    Hero "Tu plata en total hoy" con el gráfico y, en la parte blanca, la
    misma resta (Hace 6 meses → Hoy = Bajó 46.892.490 CLP (59,4%)); "💱 En
    otras monedas" con "Sin cambios" o "📈 Subió / 📉 Bajó X".
  - **Agregar** (Juan: "¿Qué es?" primero): seis tarjetas 🏦 Cuenta · 🐷
    Ahorro · 📈 Inversión · 🏠 Bien · 💳 Deuda · 🤝 Te deben, con ejemplos;
    el resto del formulario aparece al elegir y las tarjetas quedan en una
    fila con "Cambiar". Después: "¿De qué tipo?" (solo los tipos de lo
    elegido, con emoji y "➕ Nuevo tipo" al final), "¿Cómo se llama?" (con un
    ejemplo de lo elegido), el monto en `MontoBanda` (rojo en deudas, verde
    en Te deben, lila en lo demás) con su nota dentro. En deudas: "¿Es una
    deuda de verdad?" 💳 Sí, la debo / 📦 Es un encargo. Opcionales
    (`Opcionales`): 💱 Otra moneda · 📅 Desde cuándo · 📈 Cambia de valor (o,
    en deudas, 🏛️ A quién le debes · 💵 Cuota · 🏁 Hasta cuándo) · 👥 Es de
    varios; se abren solos si tienen un error. Sin numerar. Botón "🏦 Agregar
    cuenta / 🐷 ahorro / 📈 inversión / 🏠 bien / 💳 deuda / 🤝 lo que te
    deben". Al crear: "🎉 [nombre] quedó agregada".
  - El orden del formulario es lo único que cambia en comportamiento; los
    datos que se guardan son los mismos.
- **Verificado:** `tsc` sin errores; capturas web de Tu plata (claro y
  oscuro), desactivadas cerradas y abiertas, Evolución, Agregar vacío, con
  Cuenta, con Deuda y sus opcionales, la lista de tipos y "Nuevo tipo"; se
  creó una inversión de prueba hasta "¿Qué compartes…?" y se desactivó
  ("Prueba G35 fondo", queda en la base local); los totales no cambian con
  las desactivadas.
- **Fuera de este frente (anotado):**
  - Juan (2026-10-09): ver cómo consolidar períodos largos cuando las fechas
    no son del mes en curso (p. ej. un crédito de 2024 que entró al
    patrimonio en 2026 hace caer el gráfico un 59%). → Resuelto en GAPS G38
    (2026-10-09): anotar no es ganar ni perder.
  - Con "Del hogar", la lista de un grupo (desde la composición del Inicio)
    trae solo las cuentas de los otros miembros (`alcance=hogar`), así que no
    cuadra con la cifra del Inicio. Ya pasaba antes; arreglarlo cambia la
    consulta, no lo visual. → Resuelto en GAPS G37 (2026-10-09).

### 10–19. Detalle de cuenta y lo que se abre desde ahí (`ElementoDetalleScreen`, `EditarElementoScreen`, `AjustesElementoScreen`, `ValorizarScreen`, `ValorizacionDetalleScreen`, `RegistrarAjusteScreen`, `AjusteDetalleScreen`, `CorreccionFormScreen`, `ValorEnFechaScreen`, `HistorialScreen`)  ✅ (aprobado por Juan y mergeado, 2026-10-09)

- **Cómo se veían:** "Valor vigente" (el hipotecario, "−47.748.000" en rojo);
  una ficha de siete filas con jerga (Categoría, Ámbito, Estado…); en deudas
  "Estado: Parcialmente pagada" y una nota sobre el interés; movimientos con
  flechas; "Valorizaciones" y "Ajustes patrimoniales" en dos secciones, aun
  vacías ("Sin ajustes."); acciones en cuatro lugares ("Editar" cortado
  arriba, "Registrar" como enlace, menú de íconos grises, textos rojos). Los
  formularios numerados con el monto como "0" y recuadros que se explican
  ("—no se suma—"); Registrar ajuste pedía la diferencia y "¿menor o
  mayor?"; los detalles con "Estado: Vigente" y "Corregir" cortado; Valor en
  otra fecha solo con un campo; el Historial con "Moneda: — → Clp",
  "Fondo mutuo fintual", "1 ítem", comandos sin traducir
  ("Registrarplatadeotrapersona") y JSON crudo.
- **Propuesta aprobada por Juan (2026-10-09) e implementada** (rama
  `feat/G35-detalle-cuenta`). Decisiones: Corregir el saldo pregunta
  "¿Cuánto tiene de verdad?"; valorizaciones y ajustes en una sola sección;
  todo el bloque en una rama; **las filas que abren un detalle llevan "›"**
  (Juan).
  - **Piezas comunes:** `TxRow` muestra "›" cuando la fila se puede tocar
    (en toda la app); `BandaDetalle` y `AvisoDetalle` (la banda y el aviso
    del detalle de Movimiento, ahora compartidos); `CambioPeriodo` acepta
    sus etiquetas y `subirEsMalo` (deudas en rojo cuando suben); `Opcional`
    pasa de enlace "+ …" a `Pastilla` con emoji (también en Presupuesto,
    Frecuente y Programado).
  - **Detalle:** banda del color de lo que es (rojo deuda, verde te deben,
    lila lo demás) con "🏦 Tiene / 💳 Debes / 🏠 Vale / 🤝 Te deben" y el
    monto (la deuda en positivo); debajo el tipo si no repite el nombre,
    "📦 Encargo de otra persona", el estado solo si dice algo (⏰ En mora,
    ✅ Pagada, 🤝 Condonada, ❌ Incobrable) y "📅 Desde…". Dentro de la
    banda, "🙋 Tu parte (60%)" si es compartida y, con metas, la resta del
    Inicio (🐷 Guardado para metas − … = ✅ Puedes gastar). Deudas: "Pagaste
    X de Y" con la barra y 💵 Cuota · 🏁 Vence · 🏛️ Le debes a · 📅 Empezó ·
    📈 Tasa "4,2% al año" · 📝 Notas. "👥 De quién es: Tú 60% · Pareja 40%"
    solo si es de varios. Sale la ficha (Categoría, Ámbito, Estado, "Con el
    hogar" vive en Ajustes de la cuenta).
  - 🎯 En metas con el emoji de cada meta; 🧾 Movimientos como en la pestaña
    (emoji de la categoría, 5 y "⏬ Ver todos (N)"); 📈 Cambios de valor
    (valorizaciones y correcciones de saldo por fecha, solo si hay). En una
    deuda los montos se muestran como cambian lo que debes: pagar "−420.000"
    en verde, un interés "+168.000" en rojo.
  - Acciones en una lista con emoji: ✏️ Editar · ⚙️ Ajustes de la cuenta ·
    📈 Actualizar cuánto vale · 🔧 Corregir el saldo · 🗓️ ¿Cuánto valía
    antes? · 🕓 Historial de cambios. Pie: "💸 Anotar movimiento" / "💳
    Pagar" / "🤝 Me pagaron" y la secundaria ("💹 Sumar intereses" o "📈
    Actualizar cuánto vale"). Al final, botones 📦 Desactivar · 🗑️ Eliminar ·
    "🤝 Me perdonaron la deuda" / "❌ No me van a pagar" (condonar /
    incobrable, en palabras). Desactivada: aviso arriba y "♻️ Reactivar".
  - **Editar:** sin numerar, tipos de lo mismo que es con emoji, "💳 De la
    deuda" siempre visible (todo opcional), "👥 ¿De quién es?" y "✏️ ¿Estaba
    mal anotado?" como botón.
  - **Ajustes de la cuenta:** 🎨 Cómo se ve · 👥 Con el hogar · 📈 Su valor
    ("Para casas, autos o inversiones: te deja anotar cuánto valen.") y
    "⚙️ Más opciones" como botón.
  - **Actualizar cuánto vale** (antes "Registrar valorización"): banda lila
    con 📈 y la resta en vivo (📍 Hoy dice → ✏️ Ahora = 📈 Sube / 📉 Baja);
    sale el recuadro; "📈 Guardar valor".
  - **Corregir el saldo** (antes "Registrar ajuste patrimonial"): "¿Cuánto
    tiene de verdad?" (en deudas "¿Cuánto debes de verdad?") y la app
    calcula la diferencia: 📍 Hoy dice → ✅ De verdad = Sube / Baja. Se
    guarda lo mismo que antes (el ajuste con su monto con signo). "¿Por qué
    no cuadra?" y una línea: "Úsalo si no sabes qué pasó. Si sabes, mejor
    anota el movimiento." **Sumar intereses** (mismo formulario): banda roja
    con el interés sugerido y la resta 📍 Hoy debes → ✏️ Después = 💹 Sube.
  - **Cambio de valor / Corrección de saldo** (detalles): banda con
    "📈 Subió su valor" o "💹 Debes más" / "🔧 Subió el saldo", la fecha y
    la resta Antes → Después; "📝 Por qué"; botones ✏️ Corregir y 🗑️
    Eliminar (salen de la barra superior); sin "Estado: Vigente" (aviso si
    se eliminó).
  - **Corregir:** banda con "Hoy dice X", "¿Por qué lo cambias?", "✏️
    Guardar cambio".
  - **¿Cuánto valía antes?** (antes "Valor en otra fecha"): 1 mes · 6 meses ·
    1 año · 📅 Otra, y la respuesta al tiro como resta (🗓️ Valía el … → 📍
    Hoy = Subió / Bajó); en deudas "Debías / Hoy debes".
  - **Historial:** una fila por acción con emoji (✨ La agregó, ✏️, 📦 La
    desactivó, ♻️, 🗑️…); "Tú" en vez del propio nombre; solo el valor nuevo
    cuando antes no había nada; montos con moneda, fechas legibles, textos
    tal como se escribieron, "Tú 60% · Otra persona 40%", lo que se comparte
    en palabras; frases para las acciones que faltaban y, sin frase,
    "Registrar plata de otra persona" en vez de "Registrarplatadeotrapersona".
    Sale "No se puede editar ni borrar". Sirve también a Meta y Ahorro.
- **Verificado:** `tsc` sin errores; capturas web del Detalle (cuenta
  corriente, hipotecario, departamento compartido, Fintual, desactivada y
  modo oscuro), Editar, Ajustes de la cuenta, Actualizar cuánto vale con un
  monto, Corregir el saldo con un monto, Sumar intereses, Cambio de valor,
  Corrección de saldo (deuda), Corregir, ¿Cuánto valía antes? y el Historial
  de tres cuentas. No se guardó nada nuevo en la base local.

### 20–27. Planificar, metas y ahorro (`PlanificarScreen`, `ObjetivosScreen`, `ObjetivoDetalleScreen`, `MetaFormScreen`, `AhorrarScreen`, `AsignacionesScreen`, `AsignacionDetalleScreen`, `SacarPlataScreen`)  ✅ (aprobado por Juan y mergeado, 2026-10-09)

- **Tanda 3 en tres bloques** (Juan, 2026-10-09): A (20–27, metas y ahorro),
  B (28–31, presupuestos) y C (32–35, programados).
- **Cómo se veían:** Planificar con "Ahorrado en tus metas" y un párrafo
  ("Además: 0 USD de 1.500 USD"); metas sin su emoji, "· hogar" pegado al
  nombre, "3.8%" y "3647d"; el presupuesto "Gasto total" con el "de" en
  verde; íconos grises. Metas con "Plata que juntas para algo concreto.". La
  Meta con "Editar" cortado arriba, una ficha (Estado, Compartida, Dónde está
  la plata), partes con bandera gris, "Agregar parte" como enlace, "Eliminar
  meta" en texto rojo y "Aportar a esta meta". Nueva meta numerada, la fila
  "Emoji / Cambiar" y la moneda después del monto. Ahorrar con dos párrafos
  ("Lo libre de cada cuenta no lo descuenta…") y "+ Sumar otra cuenta". El
  Ahorro con una miga y un recuadro que explica; Sacar numerado.
- **Propuesta aprobada por Juan (2026-10-09) e implementada.** Decisiones:
  la acción se llama **"🐷 Ahorrar"** en todas partes (sale "Aportar a esta
  meta"); el plazo va como **"⏳ Faltan 10 años"** en las tarjetas y
  **"📅 Para el 3 oct 2036 · faltan 10 años"** en la Meta.
  - **Piezas comunes:** `GoalCard` acepta `emoji` y `tag`; `porcentaje()`
    ("3,8%") y `cuantoFalta()` en `format.ts`; `TarjetaMeta` (en
    `ObjetivosScreen`) la usan Planificar y Metas.
  - **Planificar:** "🐷 Guardado para metas" con la barra y, debajo, 🎯
    Quieres juntar · ⏳ Te faltan · 💱 Además, en USD (cada otra moneda en su
    línea) · ✅ Metas cumplidas. Sale la tarjeta "Avance total" (ya está
    arriba). Presupuesto: "🧾 Llevas gastado" con "✅ Te quedan X" (o "⚠️ Te
    pasaste X") bajo el título. 🗓️ Movimientos programados y ⚡ Frecuentes.
    Se corrige la doble "›" de "Sin presupuesto vigente".
  - **Metas:** sin el recuadro; tarjetas con emoji, "👥 Del hogar" y
    "🐷 Ahorrar"; "🎯 Nueva meta".
  - **Meta:** banda lila (verde si está lista) "🎯 Llevas", "40% de la meta",
    la barra y 🏁 Quieres juntar · ⏳ Te faltan. Debajo solo lo que dice
    algo: ❌ Cancelada, 👥 Con el hogar, 🏦 Se guarda en, 📅 Para el.
    "🧩 Partes" con 🐷 y la pastilla "➕ Agregar parte". Acciones en lista
    (✏️ Editar · 🕓 Historial de cambios), botón "🗑️ Eliminar meta" y pie
    "🐷 Ahorrar" / "💸 Usar plata de la meta". Meta del hogar que no puedes
    cambiar: aviso "👀" arriba.
  - **Nueva / Editar meta:** sin numerar; "¿Para qué juntas?" con el emoji
    al lado; "¿La comparten en el hogar?" sigue segunda (HZ-22) con
    "🙋 No, es mía / 👥 Sí"; la moneda en botones (🇨🇱 CLP · 💵 USD ·
    🌍 Otra, que abre la lista) antes del monto; el monto en banda con el
    emoji; al editar "¿Cómo va?" (⏳ En camino · ✅ Lograda · ❌ Cancelada).
  - **Ahorrar:** sin numerar; banda de la meta (Llevas, % y dónde se guarda)
    que en vivo suma 🐷 Ahorras y ✅ Quedarías en; la plata ajena en una
    línea ("👥 90.000 CLP de tus cuentas son de otras personas: no los
    ahorres."); "💯 Todo lo libre", "✕ Quitar" y la pastilla "➕ Sumar otra
    cuenta"; en el pie solo "🔁 Se mueven X de A a B" cuando la plata cambia
    de cuenta.
  - **Ahorro (la parte) y Ahorro sin meta:** banda "🐷 Ahorrado" con
    "🎯 Para Fondo de emergencia" (o "Sin meta"), sin miga ni recuadro;
    "🏦 En qué cuentas está" con el emoji de cada cuenta, que abre su
    detalle; 🕓 Historial; botón "🗑️ Eliminar esta parte"; pie "🐷 Ahorrar"
    / "💸 Sacar de la meta". En la lista sin meta, el monto va en su moneda
    (antes decía CLP siempre).
  - **Sacar:** sin numerar; la cuenta solo se pregunta si hay más de una; la
    resta 🐷 En la meta − 💸 Sacas de la cuenta = ✅ Queda ahorrado, una
    línea ("La plata no se mueve: vuelve a quedar libre en …") y "💸 Sacar X".
- **Verificado:** `tsc` sin errores; capturas web de Planificar, Metas, Meta
  (propia y del hogar, también en modo oscuro), Nueva meta (y "Otra"
  moneda), Editar meta, Ahorrar con un monto, Ahorro y Sacar. Destino de
  cada acción: presupuesto, Ver todos, Programados, Frecuentes, Agregar
  parte, Historial (meta y parte), Usar plata, Eliminar meta / parte,
  Ahorrar desde la parte y la cuenta desde la parte. No se guardó nada nuevo
  en la base local.

### 28–31. Presupuestos (`PresupuestosScreen`, `PresupuestoDetalleScreen`, `PresupuestoFormScreen`, `PresupuestoRubrosScreen`)  ✅ (probado por Juan y mergeado, 2026-10-09)

- **Cómo se veían:** la lista con "Lo que esperas en un período, contra lo
  real." y filas "Mensual · Individual · 1 oct 2026 → …". El detalle
  "Presupuesto individual" con "Editar" cortado, una ficha (Período, Estado,
  Ingresos "0 de 1.850.000", Ahorro "−140.000 de 400.000"), una dona de un
  solo color con el centro en otra letra y la leyenda "S", rubros "0 CLP /
  320.000 CLP · −320.000", "Fondo de emergencia 1.200.000 de 200.000" y
  "Eliminar presupuesto" en texto rojo. El formulario numerado con
  "Mens… Trime… Seme… Fecha…". Por rubro: un párrafo y 13 campos con "0"
  apilados, sin comparar con el presupuesto.
- **Cifra que no cuadraba:** el Inicio decía "📥 Te entró 250.000" en octubre y
  el Presupuesto "Ingresos 0": el resumen del mes cuenta el saldo inicial de
  una cuenta abierta en el mes (§G29) y el presupuesto no. **Juan decidió
  arreglarlo en este bloque:** el presupuesto ahora también lo cuenta como
  ingreso, sin categoría (`presupuesto.service`, e2e de presupuesto
  actualizado; anotado en GAPS §G29). Con eso "Te entró" y "Te sobra" dan lo
  mismo en las dos pantallas.
- **Propuesta aprobada por Juan (2026-10-09) e implementada.** Decisión: la
  dona queda solo si hay 2 o más categorías con gasto.
  - **Piezas comunes:** `GoalCard` acepta `mal` (barra y % en rojo);
    `Pastilla` acepta `activo` (elegida, para opciones de 44 px que se leen
    enteras); `MontoFila` (emoji, nombre y monto a la derecha); la `Dona`
    usa Nunito en el centro y pone el valor bajo el nombre en la leyenda
    (también en el Hogar); `nombrePeriodo()` ("Octubre", "Octubre a
    diciembre", "2026" o las fechas) en `PresupuestosScreen`.
  - **Presupuestos:** sin el recuadro; una tarjeta por presupuesto con
    "🗓️ Octubre", "🙋 Solo tuyo" / "👥 Del hogar", el % y "Llevas X de Y"
    (rojo si se pasó; 🏁 si está cerrado). "Fuera de vigencia" pasa a
    "Anteriores". "🧾 Nuevo presupuesto".
  - **Presupuesto:** título con el período ("Octubre"). Banda verde (roja si
    te pasaste) "🧾 Llevas gastado", "10% de lo que pensabas · 🙋 Solo
    tuyo", la barra y 🎯 Pensabas gastar · ✅ Te quedan (⚠️ Te pasaste).
    "📥 Lo que entra y lo que sobra" (si hay ingresos o ahorro esperados):
    📥 Te entró X de Y (y cada rubro de ingreso) · 🧾 Gastaste · 🎉 Te sobra
    / ⚠️ Gastaste más de lo que entró · 🐷 Querías que sobrara. "🧾 En qué
    gastaste": la dona (2 o más) y una tarjeta por categoría con su emoji,
    "Llevas X de Y" y "✅ Quedan" / "⚠️ Te pasaste" (abre sus movimientos);
    "❓ Sin categoría" como fila. "🐷 Ahorro para metas en este período" con
    el emoji de la meta, "Ahorraste X de Y" y "🎉 de más" / "⏳ Te faltan"
    (abre la meta). Acciones: ✏️ Cambiar montos · 🏁 Cerrar presupuesto
    (con fechas); botón "🗑️ Eliminar presupuesto"; pie "🧩 Repartir por
    categoría". Cerrado: aviso "🏁" arriba y sin acciones.
  - **Nuevo / Cambiar montos:** sin numerar; "¿Cuánto piensas gastar?" en
    banda verde con 🧾; "🙋 Solo mío / 👥 Del hogar" sigue segunda (HZ-22);
    "¿Cada cuánto?" en pastillas (🗓️ Cada mes · Cada 3 meses · Cada 6 meses
    · Cada año · 📅 Entre dos fechas); opcionales 📥 Lo que esperas que
    entre · 🐷 Lo que quieres que sobre · 💱 Otra moneda. Editar se llama
    "Cambiar montos".
  - **Repartir por categoría** (antes "Presupuesto por rubro"): arriba la
    resta en vivo 🎯 Pensabas gastar − 🧩 Repartido = ❓ Sin repartir (⚠️
    Repartiste de más, en rojo); 🧾 Gastos, 📥 Lo que esperas que entre y
    🐷 Ahorro para metas, cada uno como filas con emoji y el monto a la
    derecha (vacío = "—"); sin párrafos. "🧩 Guardar reparto".
  - **Gastos de una categoría (nueva, Juan 2026-10-09):** tocar una
    categoría del presupuesto saltaba a la pestaña Movimientos y cerraba el
    presupuesto (`irATab`): quien no conoce la app no nota el cambio de
    pestaña ni puede volver. Ahora se abre encima, con "atrás": título
    "🛒 Mercado · Octubre", la resta 🎯 Pensabas − 🧾 Llevas = ✅ Quedan y
    la lista de esos gastos (abre cada uno). Usa los mismos datos que la
    pestaña Movimientos (`resumen-financiero`), sin cambios en el backend.
    "❓ Sin categoría" también se abre ("Toca uno para ponerle categoría.").
    Las categorías con gasto pero sin monto pensado van como filas junto a
    "Sin categoría" (sin barra vacía). El detalle de un Movimiento sigue
    llevando a la pestaña filtrada (no se tocó). → **Cambiado después (Juan,
    2026-10-09):** el detalle de un Movimiento también abre esta pantalla
    encima, con los de esa categoría en el mes del movimiento; con una
    categoría de ingresos muestra lo que entró ("📥 Entró", "1 ingreso", en
    verde). Si el movimiento es de otro miembro (ninguna de sus cuentas es
    tuya), muestra los del hogar. Rama `feat/G35-categoria-encima`, probada por Juan y mergeada (2026-10-09).
- **Verificado:** `tsc` sin errores; e2e de presupuesto 11/11 verdes contra
  `patrimonia_test`; capturas web de la lista, el detalle (también en modo
  oscuro y con la dona, después de que Juan anotó "Curso maquillaje" y
  "Sueldo mensual"), Nuevo (y "Entre dos fechas"), Cambiar montos, Repartir,
  Gastos de una categoría (Sin categoría suma 140.000 como en el
  presupuesto; Educación; Mercado vacío) y la dona del Hogar. Destinos:
  categoría → Gastos de la categoría → un gasto → atrás → atrás vuelve al
  presupuesto; meta → Meta; Cambiar montos; Eliminar; Repartir.

### 32–35. Movimientos programados (`MovimientosProgramadosScreen`, `NuevoProgramadoScreen`, `MovimientoProgramadoDetalleScreen`, `ProgramadoFormScreen`)  ✅ (probado por Juan y mergeado, 2026-10-09)

- **Cómo se veían:** la lista con el recuadro "Se confirman cuando llega la
  fecha.", flechas grises ↑ ↓ ⇄, subtítulos cortados ("Gasto · 5 nov 2026 ·
  cada m…"), filas sin detalle llamadas "Gasto" o "Transferencia" y un sueldo
  que ya llegó como "Pago confirmado". El detalle con "Editar" cortado arriba,
  "Gasto · pendiente", una ficha con "Fecha programada" y "Observaciones: Luz"
  (repetía el nombre) y "Este mes no" en rojo como si fuera peligroso.
  Confirmar / Editar numerados y con el monto como un "0" con línea. Programar
  numerado, gris, con Ingreso elegido de entrada y "¿Se repite?" en lista.
- **Propuesta aprobada por Juan (2026-10-09) e implementada** (rama
  `feat/G35-programados`). Decisiones: Programar parte en **Gasto**; **sin**
  resumen del mes arriba de la lista (serían cifras nuevas que cuadrar con el
  Inicio).
  - **Programados:** sin el recuadro; cada fila con el emoji de su categoría
    (o 💸 💰 🔁 del "+"); nombre = detalle, si no la categoría, si no "Gasto
    desde Cuenta corriente" / "Ingreso a …" / "De … a …"
    (`tituloProgramado`). Subtítulo corto: "📅 5 nov · 🔁 Cada mes", "⏰ Era
    el 1 oct · ¿se pagó?" (¿llegó? en un ingreso), "✅ Pagado / Llegó / Hecho
    · 5 oct", "❌ Cancelado · 8 nov". Grupos "⏰ Por confirmar" (primero) y
    "✅ Ya resueltos". Pie "🗓️ Programar movimiento".
  - **Programado:** el título de la pantalla es su nombre. Banda del color
    del tipo: "💸 Vas a pagar" / "💰 Te va a llegar" / "🔁 Vas a mover" con
    "📅 5 nov 2026 · faltan 27 días"; vencido "Tocaba pagar" con "⏰ Era el
    1 oct · ¿se pagó?"; hecho "Pagaste" con "✅ fecha"; cancelado en gris
    "No se hizo". Debajo: 🔁 Se repite · 🏦 Sale de / Llega a (tocable) · la
    categoría con su emoji. Acciones en lista: 🧾 Ver lo que quedó anotado ·
    ✏️ Cambiar monto o fecha · ⏭️ Este mes no ("No se anota nada esta
    vez"). Botón "🛑 Dejar de repetir" o "🗑️ Cancelar este movimiento".
    Pie: "✅ Sí, se pagó" + "✏️ Fue otro monto" si venció; "✅ Ya lo pagué"
    (Ya llegó / Ya lo hice) si no.
  - **Confirmar / Cambiar monto o fecha:** sin numerar; el monto en la banda
    del tipo (`MontoBanda`); "Editar programado" pasa a "Cambiar monto o
    fecha"; al confirmar, el pie dice "💸 Se anota un gasto de 35.000 CLP
    desde Cuenta corriente." y "✅ Confirmar pago" ("✅ Sí, llegó" en un
    ingreso).
  - **Programar:** sin numerar; "💸 Gasto · 💰 Ingreso · 🔁 Moví plata";
    monto en banda; cuentas y categorías con emoji (las subcategorías dicen
    "Dentro de …"); "¿Se repite?" en pastillas (No · 🔁 Cada mes · 📆 Cada
    año); "📝 Detalle" como opcional; resumen con el emoji y "🗓️ Programar
    gasto / ingreso / movimiento".
- **Verificado:** `tsc` sin errores; capturas web de la lista, el detalle
  (pendiente, vencido, hecho y cancelado), Confirmar, Cambiar monto o fecha y
  Programar (vacío y lleno). Destinos: fila → detalle; Cambiar monto o fecha;
  Ya lo pagué / Fue otro monto → Confirmar; Ver lo que quedó anotado;
  Cancelar → formulario de motivo → cancelado; Programar gasto → vuelve a la
  lista con el nuevo en "⏰ Por confirmar". Dato de prueba en la base local:
  "Prueba G35 vencido" (12.000, 1 oct), creado y cancelado.

### 38–40. Hogar, Patrimonio del hogar y Movimientos del hogar (`HogarScreen`, `HogarConsolidadoScreen`, `MovimientosHogarScreen`)  ✅ (probado por Juan y mergeado, 2026-10-09)

- **Tanda 4 en dos bloques** (Juan, 2026-10-09): A (38–40) y B (41–43:
  Entre ustedes, Pagar, Gestionar hogar).
- **Cómo se veían:** el Hogar con "Plata del hogar" sin emojis y un párrafo
  debajo; "Entre Pareja y tú" con íconos grises, fechas "2026-10-08" y
  subtítulos cortados ("Pagado · 20…"); todas las cuentas con la misma
  billetera; "Para transferir" con un párrafo; la meta sin emoji y "3.8%";
  menús con jerga ("moneda de consolidación", "activos y pasivos",
  "patrimonio consolidado") e "Invitaciones recibidas" siempre visible.
  Patrimonio del hogar repetía el mismo recuadro, "Disponible en cuentas",
  "Parte que está en cuentas 3%", una dona "Activo / Liquidez" y "Deuda
  100%". Movimientos del hogar era una lista aparte (recuadro explicativo,
  flechas grises, títulos "Gasto" / "Transferencia", sin totales).
- **Cifra que no cuadraba:** Patrimonio del hogar decía "Metas: 3 (3 en
  progreso)" y "1.500.055 CLP de 11.001.500 CLP" mientras el Hogar mostraba
  una sola meta del hogar: `/hogares/:id/metricas` contaba las metas de
  **todos** los miembros, también las personales, y sumaba monedas
  distintas como CLP. **Juan aprobó arreglarlo:** ahora cuenta solo las
  metas compartidas con ese hogar (`consolidacion.service`, e2e de
  consolidación actualizado con una meta personal que no cuenta). Requiere
  deploy en Render.
- **Propuesta aprobada por Juan (2026-10-09) e implementada.** Decisión:
  Movimientos del hogar **es la pestaña Movimientos en "Del hogar"** (encima,
  con atrás, sin el selector), para que haya una sola versión de esa lista y
  sus cifras cuadren.
  - **Piezas comunes:** `cargarCuentasHogar()` y `deQuien()` en
    `cuentasHogar.ts` (lo que suma al hogar y lo que se puede transferir,
    ordenado como el Inicio; "🙋 Tuya" / "👥 Tú y Pareja" / "👤 De Pareja"),
    que usan Hogar y Patrimonio del hogar. `FilaEntre` lleva emoji (🧾 / 🔁)
    y `diaCorto()` ("8 oct", con año si no es el actual).
  - **Hogar:** "🏠 Plata del hogar" con 💰 Tienen · 💳 Deben (abre
    Patrimonio del hogar), sin el párrafo. "🤝 Entre Pareja y tú" con
    "✅ Pareja te pagó · 8 oct", "⏰ Le pediste a Pareja", "⏰ Pareja te
    pidió · toca para pagar"; las transferencias con la cuenta y la fecha.
    "🏠 Lo que suma al hogar" con el emoji de cada cuenta y de quién es.
    "🔁 Para transferirles" sin el párrafo. "🎯 Metas del hogar" con la
    tarjeta de Planificar (emoji, "3,8%", 🐷 Ahorrar). "Más del hogar":
    👥 Personas del hogar · 🧾 Movimientos del hogar · 📩 Te invitaron a
    otro hogar (solo si hay invitaciones). Sale "Patrimonio del hogar" del
    menú (lo abre la cifra).
  - **Patrimonio del hogar:** la cifra con la resta debajo, en la misma
    tarjeta: 🏦 Cuentas · 🏠 Bienes · 💰 Tienen · 💳 Deudas (−) · 🏠 Plata
    del hogar (con varias monedas, una resta por moneda). "🏦 Las cuentas y
    bienes del hogar" (cada una abre su detalle) y "🎯 Metas del hogar" con
    las mismas tarjetas.
  - **Movimientos del hogar:** la pestaña en "Del hogar". De paso, las
    transferencias en "Del hogar" decían "Entre tus cuentas" aunque una
    cuenta fuera de Pareja: ahora "Entre cuentas del hogar" / "Salió del
    hogar" / "Entró al hogar" (también en la pestaña).
- **Verificado:** `tsc` sin errores; tests de `solicitudes` 5/5; e2e de
  consolidación 5/5 contra `patrimonia_test`; capturas web del Hogar,
  Patrimonio del hogar (también en modo oscuro) y Movimientos del hogar.
  Destinos: cifra → Patrimonio del hogar; transferencia de "Entre" →
  Movimiento; cuenta → su detalle; Para transferirles → Moví plata; meta →
  Meta; 🐷 Ahorrar → Ahorrar; Personas del hogar → Gestionar hogar;
  Movimientos del hogar → un gasto → atrás → atrás vuelve al Hogar. No se
  guardó nada nuevo en la base local.

### 41–43. Entre ustedes, Pagar y Personas del hogar (`EntreMiembrosScreen`, `PagarSolicitudScreen`, `GestionHogarScreen`)  ✅ (probado por Juan y mergeado, 2026-10-09)

- **Cómo se veían:** Entre ustedes en una sola lista (lo que te toca pagar
  mezclado con lo resuelto), subtítulo cortado ("⏰ Demo te pidió · toca
  para …"), solicitudes pagadas sin poder tocarse y una nota "Las
  transferencias son de los últimos 30 días.". Pagar con un párrafo gris,
  pasos numerados, "Va a" con un ícono gris y dos botones grandes ("No me
  corresponde" casi con el mismo peso que pagar); una solicitud resuelta,
  un párrafo y "Listo". Gestionar hogar con campos de formulario, la nota
  "Cambiarla no recalcula…", el selector de rol cortado ("Miem…"),
  "Remover" subrayado, "Los cambios se guardan solos." y "Salir" /
  "Eliminar" como texto rojo.
- **Propuesta aprobada por Juan (2026-10-09) e implementada.** Decisiones:
  el rol se cambia en una **hoja al tocar al miembro**; "No me corresponde"
  va como **enlace de texto** (zona de 44 px).
  - **Piezas comunes:** `FilaEntre` lleva `grupo` (toca · espera ·
    resuelto) y se ordena así; una solicitud pagada abre la transferencia
    con que se pagó (`eventoPagoId`); `comoVa()` se exporta.
  - **Entre ustedes:** grupos "⏰ Te toca", "⏳ Esperando a Demo" (o
    "Esperando que te paguen" con varios miembros) y "✅ Ya resuelto";
    "⏰ Demo te pidió · 9 oct"; pie "🗓️ Las transferencias, de los últimos
    30 días.". El Hogar muestra las mismas filas, con lo que te toca arriba.
  - **Pagar:** banda del color de Moví plata: "🧾 Tu parte de
    Supermercado" ("Demo pagó 60.000 CLP · 8 oct") o "🔁 Le llegaron a
    Demo" ("Tuyos, sin anotar · 9 oct"); sin numerar; la cuenta solo se
    pregunta si hay más de una (con emojis); 🏦 Sale de · 👤 Llega a; la
    línea "🔁 Es una transferencia: no cuenta como gasto."; pie "✅ Anotar /
    Transferir X" y el enlace "🙅 No me corresponde". Resuelta o pedida por
    ti: la misma banda con cómo va ("✅ Le pagaste a Demo · 8 oct"),
    🏦 Llega a y "🧾 Ver la transferencia".
  - **Personas del hogar** (antes "Gestionar hogar", título con el nombre
    del hogar): "🏠 ¿Cómo se llama el hogar?" (se guarda al salir);
    "👥 Quiénes están" con la inicial en un círculo y "👑 Administra" /
    "🙋 Miembro"; tocar a otro miembro (si administras) abre la hoja
    👑 Hacer administrador / 🙋 Dejar como miembro · 🚪 Sacar del hogar;
    la pastilla "➕ Invitar a alguien"; "💱 ¿En qué moneda ven el total?"
    en pastillas (🇨🇱 CLP · 💵 USD · 🌍 Otra, que abre la lista) sin la
    nota; botones "🚪 Salir del hogar" y "🗑️ Eliminar hogar" (solo si
    administras). Remover pasa a llamarse "Sacar del hogar".
- **Verificado:** `tsc` sin errores; tests de `solicitudes` 6/6; capturas web
  de Entre ustedes y Pagar (como Pareja, con una solicitud de prueba
  pendiente) y Personas del hogar con la hoja del miembro y "Otra" moneda.
  Destinos: Ver todo → Entre ustedes; "Demo te pidió" → Pagar; solicitud
  pagada → la transferencia; Personas del hogar → hoja; Invitar a alguien →
  Confirmar con el correo. Dato de prueba en la base local: solicitud
  "Transferencia sin anotar" de 15.000 (Demo → Pareja, pendiente).
- **Pendiente para la tanda 5:** en Ajustes la fila sigue diciendo
  "🏠 Gestionar hogar" y abre "Personas del hogar"; alinear el nombre al
  revisar Ajustes.

### 44, 46, 47 y 54. Notificaciones, Secciones del Inicio, Mi perfil y Confirmar (`NotificacionesScreen`, `AjustesVisualizacionScreen`, `PerfilScreen`, `AccionFormScreen`)  ✅ (probado por Juan y mergeado, 2026-10-09)

- **Cómo se veían:** Notificaciones con tarjetas iguales, un punto rojo para
  lo nuevo, "· nueva · toca para abrir" en cada una y el rótulo "Avisos"
  repitiendo el título. Secciones del Inicio con interruptores de solo
  texto, la nota "Se guarda en tu cuenta…" y "Mostrar todas" subrayado.
  Mi perfil como formulario (campo "Nombre", fila "Correo", "Los cambios se
  guardan solos." y "Desactivar mi cuenta" en rojo suelto). Confirmar con un
  párrafo gris, el paso "1" con una sola pregunta y el botón deshabilitado
  sin pista de qué escribir.
- **Propuesta aprobada por Juan (2026-10-09) e implementada.** Decisiones:
  Notificaciones agrupa en **Nuevos / Ya vistos** (no por fecha); las cuatro
  pantallas en una sola rama.
  - **Notificaciones:** "🔔 Nuevos" con la pastilla "✅ Marcar todo como
    leído" (solo si hay nuevos) y "Ya vistos". Cada fila: emoji del tipo en
    un círculo (🧾 te piden tu parte · 🔁 transferencia · 🙅 rechazada ·
    🗓️ programado · 🎉 meta completada · 🐷 plata de una meta · ✉️
    invitación), título, detalle, fecha a la derecha y "›" si abre algo. Lo
    nuevo: título en negrita y círculo del color de acento. Vacío: "🔕 Nada
    nuevo por ahora".
  - **Secciones del Inicio:** en el orden del Inicio, con emoji y qué
    muestra: ✅ Puedes gastar (Debajo del total) · 🏦 Tus cuentas · 🎯 Tus
    metas · 📊 Así va el mes · ⚡ Atajos. "👀 Mostrar todas" como pastilla,
    solo si hay alguna oculta; nota "📱 Se ve igual en todos tus teléfonos.".
  - **Mi perfil:** tarjeta con la inicial, el nombre y el correo; "✏️ ¿Cómo
    te llamamos?" (se guarda al salir); "📧 Tu correo"; botón "👋 Desactivar
    mi cuenta" (como "🗑️ Eliminar hogar"). Sin la nota.
  - **Confirmar:** banda con el emoji de la acción y la explicación (roja
    suave si es `peligro`, del acento si no); sin número de paso; ejemplo en
    el campo según el comando ("Ej.: lo anoté por error", "Ej.: ya no la
    uso"…); el botón lleva el mismo emoji. Emoji y ejemplo salen del nombre
    del comando (`emojiDe`, `ejemploDe`), sin tocar las pantallas que la abren.
  - **Ajustes (pendiente de la tanda 4):** la fila pasa a "👥 Personas del
    hogar · Quiénes están, nombre y moneda"; también el título de respaldo de
    la ruta y la nota de Crear hogar ("…en Ajustes › Personas del hogar").
- **Verificado:** `tsc` sin errores; capturas web como Demo. Destinos:
  aviso de programado → su detalle; aviso de transferencia → Pagar (resuelta);
  al volver, el aviso abierto pasa a "Ya vistos"; Marcar todo como leído
  deja todo en "Ya vistos" y quita la pastilla; Personas del hogar abre la
  pantalla; Mi perfil → Confirmar con la banda y el botón activo al
  escribir; ocultar Atajos muestra "Mostrar todas" y esta las vuelve a
  prender. Dato de prueba: 2 avisos de Demo marcados como no leídos en la
  base local.
- **Rama y estado:** `feat/G35-tanda5` · probada por Juan y mergeada (2026-10-09).

### 55–60. Acceso y primer uso (`LoginScreen`, `RegistroScreen`, `RecuperarPasswordScreen`, `BienvenidaScreen`, `CrearHogarScreen`, `InvitacionesScreen`)  ✅ (aprobado por Juan y mergeado, 2026-10-09)

- **Cómo se veían:** con la paleta y la letra del Paso 0, pero sin emojis ni
  marca: título, párrafo gris, campos "Email" / "Contraseña" y enlaces
  subrayados con raya ("No tengo cuenta — registrarme"). Bienvenido con dos
  botones entre dos párrafos; Crear hogar con pasos numerados; cada
  invitación con solo el nombre del hogar y Aceptar / Rechazar como dos
  botones grandes. Sin sesión, la app abría en Crear cuenta (también al
  cerrar sesión).
- **Propuesta aprobada por Juan (2026-10-09) e implementada.** Decisiones:
  sin sesión se entra por **Entrar** (Login primero en la pila, porque al
  cerrar sesión se toma la primera pantalla); una sola rama para las seis;
  textos y emojis tal cual la propuesta.
  - **Piezas comunes** (`ui/acceso.tsx`): cabecera de marca (🌳 en un
    círculo lila como símbolo de crecimiento familiar, Juan 2026-10-09;
    "PatrimonIA", "Tu plata y la de tu hogar, en orden" y el título, que
    lleva el emoji de cada pantalla); banda 📬 del acento; enlace sin subrayar de 44 px; pie con la
    pastilla que lleva a la otra pantalla ("¿Primera vez? ✨ Crear cuenta" /
    "¿Ya tienes cuenta? 👋 Entrar").
  - **Entrar:** "👋 ¡Hola de nuevo!" · "📧 Tu correo" · "🔒 Tu contraseña" ·
    Entrar · "¿Olvidaste tu contraseña?".
  - **Crear cuenta:** "✨ Crea tu cuenta" · "✏️ ¿Cómo te llamamos?" primero ·
    "📧 Tu correo" · "🔒 Elige una contraseña". Paso del código: "Revisa tu
    correo", banda "📬 Te mandamos un código a … · vence en 15 min", "🔢
    Escribe el código", "✅ Confirmar" y "← Cambiar mis datos" (los datos se
    ocultan en vez de quedar deshabilitados).
  - **Recuperar:** "🔑 ¿Olvidaste tu contraseña?" con la banda 📬 en los dos
    pasos, "📬 Mandar código", "🔒 Cambiar contraseña", "No me llegó, pedir
    otro"; pie "¿Te acordaste? 👋 Entrar". Listo: "✅ Listo, ya tienes
    contraseña nueva", banda "🔐 Cerramos tu sesión en todos tus teléfonos." y
    "👋 Entrar".
  - **Bienvenido:** "👋 Hola, {nombre}" · "¿Cómo quieres empezar?" y dos
    tarjetas con "›": 🏠 Crear mi hogar ("Aunque vivas solo: ahí se ordena tu
    plata") y ✉️ Me invitaron ("Únete al hogar de otra persona"). Al pie,
    "🚪 Cerrar sesión".
  - **Crear hogar:** sin números de paso; "🏠 ¿Cómo se llama tu hogar?" (Ej.:
    Casa), "💱 ¿En qué moneda quieres ver el total?", pie "👑 Quedas a cargo
    del hogar; después invitas a los demás." y "🏠 Crear mi hogar".
  - **Invitaciones:** tarjeta "🏠 {hogar}" + "Te invitaron · {fecha}", "✅
    Unirme" y "No, gracias" como enlace. Vacío: "📭 Todavía no te invitan" +
    "Pídele a quien te quiera sumar que te invite con tu correo: {correo}".
    Quién invitó no se muestra: la API solo entrega su id (backend fuera de
    G35).
  - Error de correo: "Escribe un correo válido." (antes "email").
- **Verificado:** `tsc` sin errores; capturas web. Destinos: la app abre en
  Entrar; pie → Crear cuenta y vuelta; ¿Olvidaste…? → Recuperar; Mandar
  código → paso del código; No me llegó → vuelve al correo; código correcto →
  Listo → Entrar; Bienvenido → Crear hogar y → Invitaciones (con la
  invitación de prueba); Cerrar sesión → Entrar. Zonas de toque ≥44 px
  (pastillas del pie, enlaces, tarjetas de 88 px). El paso del código de
  Crear cuenta no aparece en local (sin correo configurado, el token llega
  directo): revisado solo en el código. Datos de prueba en la base local:
  usuario `nuevo.g35@patrimonia.cl` (clave demo1234, sin hogar) con una
  invitación pendiente a "Casa Riquelme".
- **Ícono de la app (descartado por ahora, Juan 2026-10-09):** se evaluó
  cambiar el ícono del teléfono (hoy el de Expo por defecto, `app/assets/`)
  por el árbol. No se hace: con Expo Go el teléfono muestra el ícono de Expo
  Go, así que solo se vería el favicon web. Se retoma cuando se compile la
  app propia (EAS Build / APK / TestFlight): `icon.png`, las tres capas del
  ícono adaptable de Android, `favicon.png` y `splash-icon.png`.
- **Rama y estado:** `feat/G35-tanda6` · aprobada por Juan y mergeada (2026-10-09).
