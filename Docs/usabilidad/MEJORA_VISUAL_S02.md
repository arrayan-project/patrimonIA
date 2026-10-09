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
2. **Hoja "¿Qué quieres anotar?"** (`hooks/useAnotar`) — botón "+". Gasté ·
   Recibí · Moví plata · Ahorrar para una meta · Pagar tarjeta · Agregar
   cuenta.
3. **Registrar movimiento** (`RegistrarMovimientoScreen`, título según el
   tipo: Gasté / Recibí / Moví plata / Pagar tarjeta) — hoja "+", Hogar,
   Frecuentes. Elegir un frecuente; monto; cuenta; categoría (y crear una
   nueva); fecha; detalle y etiquetas opcionales; "¿De quién es?" (Mío / de
   otra persona, y crear persona); compartir un gasto con el hogar (la mitad u
   otro monto, con quiénes, a qué cuenta te transfieren); recibir de alguien
   del hogar o "Avisarle a [miembro]" si no aparece; sacar de una meta; "¿Se
   repite?" (cada mes o año); guardar.
4. **Movimientos** (`MovimientosScreen`) — pestaña. Período Mes / Año /
   Recientes y flechas para moverse; Míos / Del hogar; balance del período;
   gráfico ingresos vs. gastos por mes; gastos e ingresos por rubro y filtrar
   por uno; lista por fecha; abrir un movimiento; botón "+".
5. **Movimiento** (`MovimientoDetalleScreen`) — Movimientos, cuenta, Hogar.
   Ver datos (fecha, cuentas, categoría, detalle, efecto en la cuenta); ir a
   la cuenta, a la categoría o al presupuesto del mes; Editar (→ Editar
   movimiento); Guardar como frecuente; Eliminar movimiento.
6. **Editar movimiento** (`CorregirMovimientoScreen`) — Movimiento. Cambiar
   monto, detalle y etiquetas; motivo de la corrección; guardar.

### Tanda 2 · Mi plata y mis cuentas

7. **Mi patrimonio** (`PatrimonioSeccionScreen`) — Inicio. Lista de cuentas y
   bienes por categoría; gráfico del último año; "Consultar otra fecha o
   período"; abrir una cuenta; Agregar cuenta o bien.
8. **Evolución de mi patrimonio** (`EvolucionPatrimonioScreen`) — Mi
   patrimonio. Elegir período; ver la evolución y el total en otras monedas.
9. **Agregar cuenta o bien** (`AgregarElementoScreen`) — hoja "+", Mi
   patrimonio, Inicio vacío. Qué es; tipo (y crear uno nuevo); nombre;
   moneda; de quién es; desde cuándo; cuota y vencimiento (deudas); si se
   valoriza; después de crear: qué compartes con el hogar (o "Ahora no").
10. **Detalle de cuenta** (`ElementoDetalleScreen`, título "Detalle") —
    Inicio, Mi patrimonio, Hogar, Movimiento. Ver valor vigente, libre para
    gastar, en metas, datos (tipo, desde, cuota, tasa, saldo pendiente);
    movimientos, valorizaciones, ajustes y ahorros de la cuenta (abrir cada
    uno); Registrar valorización; Registrar interés / ajuste; "¿Cuánto valía
    en otra fecha?"; Ajustes de la cuenta; Editar; Historial de cambios;
    Desactivar / Reactivar; Condonar deuda o Declarar incobrable; Eliminar.
11. **Editar** (`EditarElementoScreen`) — Detalle de cuenta. Nombre, tipo,
    fechas, cuota, tasa, notas, dueño; marcar como corrección y por qué;
    guardar cambios.
12. **Ajustes de la cuenta** (`AjustesElementoScreen`) — Detalle de cuenta.
    Qué compartes con el hogar (y con quiénes, avanzado); si suma al
    patrimonio del hogar; si su valor cambia con el tiempo.
13. **Registrar valorización** (`ValorizarScreen`) — Detalle de cuenta.
    Cuánto vale y a qué fecha; guardar.
14. **Valorización** (`ValorizacionDetalleScreen`) — Detalle de cuenta. Ver
    valor, antes, fecha, estado; Corregir (→ Corregir); Eliminar valorización.
15. **Registrar ajuste patrimonial** (`RegistrarAjusteScreen`) — Detalle de
    cuenta. Si el valor real es menor o mayor; monto; por qué; guardar.
16. **Ajuste patrimonial** (`AjusteDetalleScreen`) — Detalle de cuenta. Ver
    motivo, fecha, estado; Corregir; Eliminar ajuste.
17. **Corregir** (`CorreccionFormScreen`) — Valorización, Ajuste. Nuevo valor;
    por qué; guardar corrección.
18. **Valor en otra fecha** (`ValorEnFechaScreen`) — Detalle de cuenta. Elegir
    fecha; consultar.
19. **Historial de cambios** (`HistorialScreen`) — Detalle de cuenta, Meta,
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
36. **Frecuentes** (`PlantillasScreen`) — Planificar, Ajustes. Lista y
    buscador; abrir uno; Nuevo frecuente.
37. **Nuevo frecuente / Editar** (`PlantillaFormScreen`) — Frecuentes,
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
45. **Ajustes** (`AjustesScreen`) — engranaje. Tu cuenta (Mi perfil, Cerrar
    sesión); Cómo se ve (Tema, Fechas, Moneda principal en Inicio, Secciones
    del Inicio); Avisos; Hogar (Gestionar hogar, Invitaciones); Tus datos
    (Categorías, Etiquetas, Agrupaciones, Frecuentes, Tipos de cuenta o bien,
    Tipos de cambio).
46. **Secciones del Inicio** (`AjustesVisualizacionScreen`) — Ajustes.
    Mostrar u ocultar cada sección; Mostrar todas.
47. **Mi perfil** (`PerfilScreen`) — Ajustes. Nombre y correo; Desactivar mi
    cuenta.
48. **Categorías de movimiento** (`CategoriasScreen`) — Ajustes. Lista y
    buscador; ordenar (subir / bajar); abrir una; Nueva categoría.
49. **Etiquetas** (`EtiquetasScreen`) — Ajustes. Lista y buscador; abrir una;
    Nueva etiqueta.
50. **Agrupaciones** (`AgrupacionesScreen`) — Ajustes. Lista y buscador; abrir
    una; Nueva agrupación.
51. **Tipos de elemento patrimonial** (`TiposElementoScreen`) — Ajustes. Lista
    y buscador; ordenar; abrir uno; Nuevo tipo.
52. **Tipos de cambio** (`TiposCambioScreen`) — Ajustes. Lista de tasas y
    buscador; Registrar tasa.
53. **Nuevo / Editar (catálogo)** (`CatalogoFormScreen`) — las cinco
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
