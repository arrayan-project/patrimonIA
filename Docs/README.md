# Documentación de PatrimonIA

**Objetivo de este archivo:** índice y mapa de todo lo que hay en `Docs/` —
qué leer primero, para qué sirve cada documento, y dónde vive lo que ya no
está vigente. Si no sabes dónde buscar algo, empieza acá.

## Estructura de carpetas

- **[diseño/](diseño/)** — los 6 documentos "fuente de verdad" (intocables,
  no se reorganizan ni se mezclan con lo demás).
- **[usabilidad/](usabilidad/)** — registros de pruebas de uso con personas
  reales y sus planes de rediseño (no canónicos; el porqué va en `GAPS.md`).
- **[retirado/](retirado/)** — documentos de análisis ya superados, cuyo
  contenido se integró a otro lado. Se conservan como registro histórico.
- **[_baseline/](_baseline/)** — los `.docx` originales de Fase 0, congelados.
- **[mockup/](mockup/)** — artefactos de diseño visual, no canónicos.
- `feature/<nombre-de-rama>/` (en la raíz del proyecto, no acá) — documentos
  de trabajo de una feature puntual todavía sin mergear a `main`. Viven fuera
  de `Docs/` a propósito: son artefactos de una rama, no documentación
  general del proyecto.

## Fuente de verdad (leer en este orden — BUILD_INSTRUCTIONS §1)

1. **[diseño/REQUISITES.md](diseño/REQUISITES.md)** — requerimientos de producto.
2. **[diseño/DDD.md](diseño/DDD.md)** — modelo de dominio: agregados, invariantes, catálogo de comandos (§T), auditoría (§U).
3. **[diseño/APPLICATION_SERVICES.md](diseño/APPLICATION_SERVICES.md)** — un caso de uso por comando (input · validaciones · orquestación · output · auditoría).
4. **[diseño/DATABASE_DESIGN.md](diseño/DATABASE_DESIGN.md)** — modelo relacional lógico. El DDL ejecutable vive en [`../api/db/init/01_schema.sql`](../api/db/init/01_schema.sql); la historia incremental en [`../api/db/migrations/`](../api/db/migrations/).
5. **[diseño/API_DESIGN.md](diseño/API_DESIGN.md)** — contrato REST: `POST /comandos/{Nombre}` + consultas.
6. **[diseño/UX_FLOWS.md](diseño/UX_FLOWS.md)** — flujos end-to-end, arquitectura de información y desgloses de pantalla.
7. **[BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)** — capa operativa (stack, orden de trabajo, qué hacer ante un vacío).

Estos 7 estaban en `.docx` hasta la Fase 52; se migraron a Markdown el 2026-09-06.
Los originales quedan congelados en [`_baseline/`](_baseline/).

## Registro de decisiones y estado

- **[../GAPS.md](../GAPS.md)** — el ledger: cada vacío o decisión de dominio (G1–G33), por qué, qué se decidió, y a qué documento se integró. Ordenado en **Pendiente** (Parte 1, con resumen priorizado) e **Implementado / decisión cerrada** (Parte 2), y dentro de cada parte por tema.
- **[retirado/DOMINIO_PENDIENTE.md](retirado/DOMINIO_PENDIENTE.md)** — *retirado*. Análisis de Fase 28; sus conclusiones están en `diseño/DDD.md` §X y `diseño/UX_FLOWS.md` Parte 3.
- **[retirado/propuesta-rediseno-C-rimu.html](retirado/propuesta-rediseno-C-rimu.html)** — *retirado* (2026-10-03). Propuesta visual C: clara pero poco comprensible; la referencia visual es `usabilidad/prototipo/prototipo-fase-d-s01.html` (ver `GAPS.md`, G33, bloque 4).
- **[retirado/UI_UX_BACKLOG.md](retirado/UI_UX_BACKLOG.md)** — *journal* de la implementación de UI/UX. El estado vigente está en `diseño/UX_FLOWS.md` Parte 3; de sus pulidos sueltos solo queda `ListItem` en dos listas, diferido a propósito (U3 en `GAPS.md`).

## Usabilidad

- **[diseño/EVALUACION_USABILIDAD.md](diseño/EVALUACION_USABILIDAD.md)** — evaluación heurística G32 (sin personas) y sus 7 ajustes aplicados.
- **[usabilidad/USABILIDAD_REAL_S01.md](usabilidad/USABILIDAD_REAL_S01.md)** — prueba con usuaria real (G32 falló → G33): hallazgos, catálogo de escenarios, plan por fases y BUG-HOG. **Fuente de verdad del frente G33.**
- **[usabilidad/RECORRIDO_ESCENARIOS_S01.md](usabilidad/RECORRIDO_ESCENARIOS_S01.md)** — Fase B de G33: recorrido de los escenarios T1/T2 en el código, con conteo y veredicto.
- **[usabilidad/BENCHMARK_S01.md](usabilidad/BENCHMARK_S01.md)** — Fase C de G33: benchmark de patrones (P-A a P-E) para cada brecha de B, hallazgos HZ-11 a HZ-17 y decisiones D-6 y D-7.
- **[usabilidad/DECISIONES_FASE_D_S01.md](usabilidad/DECISIONES_FASE_D_S01.md)** — Fase D de G33, bloque 1: decisiones D-1 a D-7 cerradas, diccionario de superficie, M9/M7 fuera de alcance y orden de la Fase E.
- **[usabilidad/CIERRE_FASE_D_S01.md](usabilidad/CIERRE_FASE_D_S01.md)** — cierre de la Fase D de G33: señal de validación con el prototipo (6 de 6), hallazgos HZ-18 a HZ-23, decisión D-8 (dos puertas y "¿de quién es?") y orden actualizado de la Fase E.
- **[usabilidad/prototipo/prototipo-fase-d-s01.html](usabilidad/prototipo/prototipo-fase-d-s01.html)** — prototipo interactivo de la Fase D (v5). En el menú `+` y el paso 2 de Gasté y Recibí manda D-8.

## Operación

- **[CORRER_EN_LOCAL.md](CORRER_EN_LOCAL.md)** — arrancar todo desde cero (local) y volver a producción.
- **[DESPLIEGUE.md](DESPLIEGUE.md)** — hospedar: Expo → Render → Neon, $0/mes.
- **[../api/db/README.md](../api/db/README.md)** — base de datos, migraciones.

## Análisis de diseño (artefactos, no canónicos)

- **[mockup/](mockup/)** — mockup navegable, mapa de IA, casos de dominio probados contra el backend.
