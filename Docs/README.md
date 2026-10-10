# Documentación de PatrimonIA

**Objetivo de este archivo:** índice y mapa de todo lo que hay en `Docs/` —
qué leer primero, para qué sirve cada documento, cuál está vigente y cuál es
historia. Si no sabes dónde buscar algo, empieza acá.

## Estado en una mirada (2026-10-10)

- **Construido y en producción** (Render + Neon): el dominio completo, la app
  rediseñada (G33 Fase E, G35 visual) y los 33 escenarios con flujos simples
  (G39).
- **Abierto:** solo G33, validar con personas reales que la app quedó simple
  (señal de Zoily positiva, no definitiva), y dos temas de operación (dominio
  propio para los correos, backups). Todo lo abierto está en
  [`../GAPS.md`](../GAPS.md), Parte 1.
- **En pausa** (decisión de Juan): compilar la app propia (push remoto e
  ícono), captcha, Fintual e integración bancaria.

## Estructura de carpetas

- **[diseño/](diseño/)** — los 6 documentos fuente de verdad del dominio
  (REQUISITES, DDD, APPLICATION_SERVICES, DATABASE_DESIGN, API_DESIGN,
  UX_FLOWS). Solo esos seis.
- **[usabilidad/](usabilidad/)** — las pruebas de uso, los frentes de rediseño
  (G32 → G33 → G35 → G39) y sus prototipos. No canónicos: el porqué de cada
  decisión va en `GAPS.md`.
  - **[usabilidad/prototipo/](usabilidad/prototipo/)** — prototipos y reglas
    de pantalla en HTML.
  - **[usabilidad/capturas/](usabilidad/capturas/)** — capturas de los bloques
    4 a 9 de la Fase E de G33 (`e4/` … `e9/`).
- **[retirado/](retirado/)** — análisis ya superados, cuyo contenido se
  integró a otro lado. Se conservan como registro histórico.
- **[_baseline/](_baseline/)** — los `.docx` originales de la Fase 0, congelados.
- **[mockup/](mockup/)** — artefactos de diseño visual, no canónicos.
- `feature/<nombre-de-rama>/` (en la raíz del proyecto, no acá) — documentos
  de trabajo de una rama todavía sin mergear a `main`.

## Fuente de verdad (leer en este orden — BUILD_INSTRUCTIONS §1)

1. **[diseño/REQUISITES.md](diseño/REQUISITES.md)** — requerimientos de producto.
2. **[diseño/DDD.md](diseño/DDD.md)** — modelo de dominio: agregados, invariantes, catálogo de comandos (§T), auditoría (§U).
3. **[diseño/APPLICATION_SERVICES.md](diseño/APPLICATION_SERVICES.md)** — un caso de uso por comando (input · validaciones · orquestación · output · auditoría).
4. **[diseño/DATABASE_DESIGN.md](diseño/DATABASE_DESIGN.md)** — modelo relacional lógico. El DDL ejecutable vive en [`../api/db/init/01_schema.sql`](../api/db/init/01_schema.sql); la historia incremental en [`../api/db/migrations/`](../api/db/migrations/).
5. **[diseño/API_DESIGN.md](diseño/API_DESIGN.md)** — contrato REST: `POST /comandos/{Nombre}` + consultas.
6. **[diseño/UX_FLOWS.md](diseño/UX_FLOWS.md)** — flujos end-to-end, arquitectura de información y desgloses de pantalla.
7. **[BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)** — capa operativa (stack, orden de trabajo, qué hacer ante un vacío).

Estos 7 estaban en `.docx` hasta la Fase 52; se migraron a Markdown el
2026-09-06. Los originales quedan congelados en [`_baseline/`](_baseline/).
Lo que cambió después (pantallas, flujos, textos) está en los documentos de
`usabilidad/` y en `GAPS.md`; los cambios de dominio o de API se integraron a
estos seis.

## Registro de decisiones y estado

- **[../GAPS.md](../GAPS.md)** — el ledger: cada vacío o decisión (G1–G40),
  por qué, qué se decidió y dónde se integró. **Parte 1:** solo lo abierto, con
  un resumen priorizado. **Parte 2:** lo implementado o cerrado como decisión.
  En un gap cerrado, "Pregunta original" es lo que estaba abierto al anotarlo y
  "Cómo se resolvió" dice qué se decidió.

## Usabilidad (en orden cronológico)

| Documento | Frente | Para qué sirve | Estado |
|---|---|---|---|
| [usabilidad/EVALUACION_USABILIDAD.md](usabilidad/EVALUACION_USABILIDAD.md) | G32 | Evaluación heurística sin personas y sus 7 ajustes. | Historia (la prueba real falló → G33) |
| [usabilidad/USABILIDAD_REAL_S01.md](usabilidad/USABILIDAD_REAL_S01.md) | G33 | Prueba con usuaria real: hallazgos HZ, catálogo de los 33 escenarios, plan por fases. | **Vigente: fuente de verdad de G33** |
| [usabilidad/RECORRIDO_ESCENARIOS_S01.md](usabilidad/RECORRIDO_ESCENARIOS_S01.md) | G33 · Fase B | Recorrido de los escenarios en el código, con conteo. | Historia (medido de nuevo en S03) |
| [usabilidad/BENCHMARK_S01.md](usabilidad/BENCHMARK_S01.md) | G33 · Fase C | Patrones de otras apps para cada brecha; HZ-11 a HZ-17. | Historia |
| [usabilidad/DECISIONES_FASE_D_S01.md](usabilidad/DECISIONES_FASE_D_S01.md) | G33 · Fase D | Decisiones D-1 a D-7 y diccionario de superficie. | Vigente (decisiones tomadas) |
| [usabilidad/CIERRE_FASE_D_S01.md](usabilidad/CIERRE_FASE_D_S01.md) | G33 · Fase D | Validación con el prototipo (6 de 6), HZ-18 a HZ-23, D-8 y orden de la Fase E. | Vigente (decisiones tomadas) |
| [usabilidad/MEJORA_VISUAL_S02.md](usabilidad/MEJORA_VISUAL_S02.md) | G35 | Las 60 pantallas, sus acciones y la ficha visual de cada una. | **Vigente: referencia visual** |
| [usabilidad/FLUJOS_SIMPLES_S03.md](usabilidad/FLUJOS_SIMPLES_S03.md) | G39 | Los 33 escenarios paso a paso, con el flujo actual de cada uno y sus patrones F-1 a F-19. | **Vigente: cómo se hace cada cosa en la app** |

**Prototipos y reglas de pantalla** ([usabilidad/prototipo/](usabilidad/prototipo/)):

- **[direccion-visual-s02.html](usabilidad/prototipo/direccion-visual-s02.html)** — dirección visual de G35 (paleta lila y pastel, Nunito, emojis). **Referencia visual vigente.**
- **[plantillas-pantalla-s01.html](usabilidad/prototipo/plantillas-pantalla-s01.html)** — las 5 plantillas de pantalla (Resumen, Lista, Detalle, Formulario, Ajustes), sus reglas y el mapa de cada pantalla a su plantilla. Una pantalla nueva se agrega al mapa. Si una plantilla contradice un hallazgo HZ decidido, gana el hallazgo.
- **[prototipo-fase-d-s01.html](usabilidad/prototipo/prototipo-fase-d-s01.html)** — prototipo interactivo de la Fase D (v5). Vale para la estructura de los flujos; lo visual lo reemplazó G35.

## Operación

- **[CORRER_EN_LOCAL.md](CORRER_EN_LOCAL.md)** — arrancar todo desde cero (local) y volver a producción.
- **[DESPLIEGUE.md](DESPLIEGUE.md)** — hospedar: Expo → Render → Neon, $0/mes; lo pendiente de operación está en su § Estado.
- **[../api/db/README.md](../api/db/README.md)** — base de datos y migraciones.

## Retirado (historia)

- **[retirado/DOMINIO_PENDIENTE.md](retirado/DOMINIO_PENDIENTE.md)** — análisis de la Fase 28; sus conclusiones están en `diseño/DDD.md` §X y `diseño/UX_FLOWS.md` Parte 3.
- **[retirado/propuesta-rediseno-C-rimu.html](retirado/propuesta-rediseno-C-rimu.html)** — propuesta visual C (2026-10-03), descartada: clara pero poco comprensible.
- **[retirado/UI_UX_BACKLOG.md](retirado/UI_UX_BACKLOG.md)** — *journal* de la implementación de UI/UX; el estado vigente está en `diseño/UX_FLOWS.md` Parte 3.

## Análisis de diseño (artefactos, no canónicos)

- **[mockup/](mockup/)** — mockup navegable, mapa de IA y casos de dominio probados contra el backend.
