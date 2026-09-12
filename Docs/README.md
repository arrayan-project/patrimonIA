# Documentación de PatrimonIA

**Objetivo de este archivo:** índice y mapa de todo lo que hay en `Docs/` —
qué leer primero, para qué sirve cada documento, y dónde vive lo que ya no
está vigente. Si no sabes dónde buscar algo, empieza acá.

## Estructura de carpetas

- **[diseño/](diseño/)** — los 6 documentos "fuente de verdad" (intocables,
  no se reorganizan ni se mezclan con lo demás).
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

- **[../GAPS.md](../GAPS.md)** — el ledger: cada vacío o decisión de dominio (G1–G30), por qué, qué se decidió, y a qué documento se integró. Lo único pendiente son 3 items bloqueados por proveedores externos.
- **[retirado/DOMINIO_PENDIENTE.md](retirado/DOMINIO_PENDIENTE.md)** — *retirado*. Análisis de Fase 28; sus conclusiones están en `diseño/DDD.md` §X y `diseño/UX_FLOWS.md` Parte 3.
- **[retirado/UI_UX_BACKLOG.md](retirado/UI_UX_BACKLOG.md)** — *journal* de la implementación de UI/UX. El estado vigente está en `diseño/UX_FLOWS.md` Parte 3; quedan 3 pulidos P2/P3 sueltos.

## Operación

- **[CORRER_EN_LOCAL.md](CORRER_EN_LOCAL.md)** — arrancar todo desde cero (local) y volver a producción.
- **[DESPLIEGUE.md](DESPLIEGUE.md)** — hospedar: Expo → Render → Neon, $0/mes.
- **[../api/db/README.md](../api/db/README.md)** — base de datos, migraciones.

## Análisis de diseño (artefactos, no canónicos)

- **[mockup/](mockup/)** — mockup navegable, propuesta de rediseño, mapa de IA, casos de dominio probados contra el backend.
