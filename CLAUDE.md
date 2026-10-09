# PatrimonIA — instrucciones para Claude Code

- Antes de cualquier tarea, lee `Docs/README.md`.
- Toda UI respeta los hallazgos UI decididos en
  `Docs/usabilidad/USABILIDAD_REAL_S01.md` §4.
- Toda lista de selección usa `Elegir` / `ElegirVarios` (hoja modal de
  `Select`, en `app/src/ui/index.tsx`), sin importar cuántas opciones tenga;
  el buscador aparece con más de 6. Nunca `SelectRow` apilados. La pantalla
  nunca crece por una lista (HZ-3).
- Citas entre documentos: por sección o punto, nunca por número de línea.
- Referencia visual vigente (G35): `Docs/usabilidad/prototipo/direccion-visual-s02.html`
  (paleta lila y pastel, letra Nunito vía `app/src/ui/Text`, emojis) y
  `Docs/usabilidad/MEJORA_VISUAL_S02.md`. El texto siempre se importa desde
  `ui/Text`, no desde `react-native`. Para la estructura de los flujos sigue
  valiendo `Docs/usabilidad/prototipo/prototipo-fase-d-s01.html`.
- Toda pantalla sigue su plantilla y las reglas comunes de
  `Docs/usabilidad/prototipo/plantillas-pantalla-s01.html` (el mapa dice qué
  plantilla usa cada pantalla; una pantalla nueva se agrega al mapa).
