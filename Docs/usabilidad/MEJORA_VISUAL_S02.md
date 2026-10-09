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
- **Pantallas apiladas:** 48, con barra superior (título + atrás).
- **Total: 59 pantallas** (más la hoja del "+", que es una pieza común).

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

20. **Planificar** (`PlanificarScreen`) — pestaña. Resumen de metas y ahorro
    sin meta; presupuesto del mes; accesos a Metas, Presupuestos, Movimientos
    programados y Frecuentes; abrir una meta o el presupuesto; crear la
    primera meta; campana; engranaje.
21. **Metas** (`ObjetivosScreen`) — Planificar, Inicio. Lista de metas; abrir
    una; Nueva meta; Ahorrar.
22. **Meta** (`ObjetivoDetalleScreen`) — Metas, Inicio, Planificar, Hogar. Ver
    avance (llevas, faltan, %); dónde está la plata (abrir cada parte);
    Aportar a esta meta; Usar plata de la meta; Agregar parte; Editar;
    Historial; Eliminar meta.
23. **Nueva meta / Editar meta** (`MetaFormScreen`) — Metas, Planificar,
    Inicio, Ahorrar. Nombre; cuánto juntar; moneda; compartir con el hogar;
    quién más puede modificarla; estado (al editar); guardar.
24. **Ahorrar para una meta** (`AhorrarScreen`) — hoja "+", Inicio, Metas,
    Meta, Ahorro. Para qué meta (o crear una); para qué parte; en qué cuenta
    está la plata; cuánto (o "Todo lo libre"); sumar otra cuenta o quitarla;
    guardar.
25. **Ahorro sin meta** (`AsignacionesScreen`) — Planificar. Lista; abrir uno;
    crear una meta.
26. **Ahorro** (`AsignacionDetalleScreen`) — Meta, Ahorro sin meta, Detalle de
    cuenta. Ver ahorrado y en qué cuentas; Ahorrar; Sacar; Historial;
    Eliminar esta parte / este ahorro.
27. **Sacar** (`SacarPlataScreen`) — Ahorro. De qué cuenta; cuánto; por qué;
    guardar.
28. **Presupuestos** (`PresupuestosScreen`) — Planificar. Lista; abrir uno;
    Nuevo presupuesto.
29. **Presupuesto** (`PresupuestoDetalleScreen`) — Presupuestos, Inicio,
    Planificar, Movimiento. Ver presupuesto vs. gastado, ingresos, ahorro, por
    rubro, ahorro por meta y sin clasificar; ir a los movimientos de un rubro;
    Editar; Editar rubros; Cerrar presupuesto; Eliminar presupuesto.
30. **Nuevo presupuesto / Editar** (`PresupuestoFormScreen`) — Presupuestos,
    Presupuesto. Solo tuyo o del hogar; cada cuánto; cuánto gastar; ingresos
    y ahorro esperados (opcional); moneda; desde / hasta; guardar.
31. **Presupuesto por rubro** (`PresupuestoRubrosScreen`) — Presupuesto. Monto
    por categoría y ahorro por meta; guardar rubros.
32. **Movimientos programados** (`MovimientosProgramadosScreen`) — Planificar,
    Inicio. Lista; abrir uno; Programar movimiento.
33. **Programar movimiento** (`NuevoProgramadoScreen`) — Movimientos
    programados. Tipo; cuánto; cuentas; categoría; fecha; detalle; "¿Se
    repite?"; guardar.
34. **Movimiento programado** (`MovimientoProgramadoDetalleScreen`) —
    Movimientos programados, aviso "¿Se pagó?". Ver datos y si se repite;
    Confirmar pago; Cambiar monto; ver el movimiento generado; ir a la
    cuenta; Editar; Dejar de repetir; Cancelar movimiento.
35. **Editar programado / Confirmar pago** (`ProgramadoFormScreen`) —
    Movimiento programado. Monto y fecha ("¿Para cuándo?" o "¿Cuándo se
    pagó?"); guardar.
36. ✅ **Frecuentes** (`PlantillasScreen`) — Planificar, Ajustes. Lista y
    buscador; abrir uno; Nuevo frecuente.
37. ✅ **Nuevo frecuente / Editar** (`PlantillaFormScreen`) — Frecuentes,
    Movimiento. Nombre; tipo; cuánto; cuentas; categoría; detalle; guardar;
    Eliminar frecuente.

### Tanda 4 · Hogar

38. **Hogar** (`HogarScreen`) — pestaña. Plata del hogar (Tienen / Deben);
    lo que suma al hogar (abrir cada cuenta); metas del hogar; "Entre
    [miembro] y tú"; Para transferir (→ Registrar movimiento); Personas;
    invitaciones recibidas; Más del hogar (Patrimonio del hogar, Movimientos
    del hogar, Gestionar hogar); campana; engranaje.
39. **Patrimonio del hogar** (`HogarConsolidadoScreen`) — Hogar. Ver Tienen /
    Deben, plata y metas del hogar por moneda (sin acciones).
40. **Movimientos del hogar** (`MovimientosHogarScreen`) — Hogar. Lista por
    mes; abrir un movimiento.
41. **Entre ustedes** (`EntreMiembrosScreen`) — Hogar. Lista de solicitudes y
    transferencias entre dos miembros; abrir un movimiento; pagar una
    solicitud.
42. **Pagar** (`PagarSolicitudScreen`) — Inicio, Entre ustedes,
    Notificaciones. Ver cuánto y a qué cuenta; Transferir (desde qué cuenta);
    No me corresponde.
43. **Gestionar hogar** (`GestionHogarScreen`) — Hogar, Ajustes. Nombre;
    moneda del total; miembros (cambiar rol, Remover); Invitar a alguien;
    Salir del hogar; Eliminar hogar.

### Tanda 5 · Avisos, ajustes y cuenta

44. **Notificaciones** (`NotificacionesScreen`) — campana. Lista de avisos;
    abrir uno (marca leído y lleva a su pantalla); marcar todos como leídos.
45. ✅ **Ajustes** (`AjustesScreen`, revisado 2026-10-09, §6) — engranaje. Tu cuenta (Mi perfil, Cerrar
    sesión); Cómo se ve (Tema, Fechas, Moneda principal en Inicio, Secciones
    del Inicio); Avisos; Hogar (Gestionar hogar, Invitaciones); Tus datos
    (Categorías, Etiquetas, Agrupaciones, Frecuentes, Tipos de cuenta o bien,
    Tipos de cambio).
46. **Secciones del Inicio** (`AjustesVisualizacionScreen`) — Ajustes.
    Mostrar u ocultar cada sección; Mostrar todas.
47. **Mi perfil** (`PerfilScreen`) — Ajustes. Nombre y correo; Desactivar mi
    cuenta.
48. ✅ **Categorías de movimiento** (`CategoriasScreen`) — Ajustes. Lista y
    buscador; ordenar (subir / bajar); abrir una; Nueva categoría.
49. ✅ **Etiquetas** (`EtiquetasScreen`) — Ajustes. Lista y buscador; abrir una;
    Nueva etiqueta.
50. ⏸ **Agrupaciones** (fuera de Ajustes hasta usarlas en Mi patrimonio, §6) (`AgrupacionesScreen`) — Ajustes. Lista y buscador; abrir
    una; Nueva agrupación.
51. ✅ **Tipos de elemento patrimonial** (`TiposElementoScreen`) — Ajustes. Lista
    y buscador; ordenar; abrir uno; Nuevo tipo.
52. ✅ **Tipos de cambio** (`TiposCambioScreen`) — Ajustes. Lista de tasas y
    buscador; Registrar tasa.
53. ✅ **Nuevo / Editar (catálogo)** (`CatalogoFormScreen`) — las cinco
    anteriores. Según el catálogo: nombre, categoría padre, para qué
    movimientos, categoría sugerida, cuentas dentro de una agrupación, monedas
    y tasa; guardar; Archivar o Eliminar.
54. **Confirmar** (`AccionFormScreen`, título según la acción) — Detalles,
    Gestionar hogar, Mi perfil. Motivo o dato que pide la acción (Eliminar,
    Desactivar, Remover, Invitar, Cerrar presupuesto, Dejar de repetir…);
    confirmar.

### Tanda 6 · Acceso y primer uso

55. **Login** (`LoginScreen`) — Email; contraseña; Entrar; ¿Olvidaste tu
    contraseña?; registrarme.
56. **Registro** (`RegistroScreen`) — Nombre, email, contraseña; Crear cuenta;
    código de registro; Confirmar registro; volver; ya tengo cuenta.
57. **Recuperar contraseña** (`RecuperarPasswordScreen`) — Email; Enviar
    código; código; nueva contraseña; Cambiar contraseña; volver a pedirlo;
    volver a iniciar sesión.
58. **Bienvenido** (`BienvenidaScreen`) — sin hogar. Crear un hogar nuevo;
    Tengo una invitación pendiente; Cerrar sesión.
59. **Crear hogar** (`CrearHogarScreen`) — Bienvenida. Nombre; moneda del
    total; crear hogar.
60. **Invitaciones pendientes** (`InvitacionesScreen`) — Bienvenida, Hogar,
    Ajustes. Aceptar; Rechazar.

(La hoja del "+", ítem 2, no es una pantalla: por eso la numeración llega a 60
con 59 pantallas.)

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
    revise esa pantalla.
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
    patrimonio en 2026 hace caer el gráfico un 59%).
  - Con "Del hogar", la lista de un grupo (desde la composición del Inicio)
    trae solo las cuentas de los otros miembros (`alcance=hogar`), así que no
    cuadra con la cifra del Inicio. Ya pasaba antes; arreglarlo cambia la
    consulta, no lo visual.

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
