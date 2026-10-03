# PatrimonIA — instrucciones para Claude Code

- Antes de cualquier tarea, lee `Docs/README.md`.
- Toda UI respeta los hallazgos UI decididos en
  `Docs/usabilidad/USABILIDAD_REAL_S01.md` §4.
- Listas de selección de más de 6 opciones: usar `Select` (hoja modal con
  buscador y scroll propio, en `app/src/ui/index.tsx`), nunca `SelectRow`
  apilados. 6 o menos: opciones visibles en línea. La pantalla nunca crece por
  una lista (HZ-3).
- Citas entre documentos: por sección o punto, nunca por número de línea.
- Referencia visual vigente: `Docs/usabilidad/prototipo/prototipo-fase-d-s01.html`.
