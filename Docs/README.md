# Documentación de PatrimonIA

## Fuente de verdad (leer en este orden — BUILD_INSTRUCTIONS §1)

1. **[REQUISITES.md](REQUISITES.md)** — requerimientos de producto.
2. **[DDD.md](DDD.md)** — modelo de dominio: agregados, invariantes, catálogo de comandos (§T), auditoría (§U).
3. **[APPLICATION_SERVICES.md](APPLICATION_SERVICES.md)** — un caso de uso por comando (input · validaciones · orquestación · output · auditoría).
4. **[DATABASE_DESIGN.md](DATABASE_DESIGN.md)** — modelo relacional lógico. El DDL ejecutable vive en [`../api/db/init/01_schema.sql`](../api/db/init/01_schema.sql); la historia incremental en [`../api/db/migrations/`](../api/db/migrations/).
5. **[API_DESIGN.md](API_DESIGN.md)** — contrato REST: `POST /comandos/{Nombre}` + consultas.
6. **[UX_FLOWS.md](UX_FLOWS.md)** — flujos end-to-end, arquitectura de información y desgloses de pantalla.
7. **[BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)** — capa operativa (stack, orden de trabajo, qué hacer ante un vacío).

Estos 7 estaban en `.docx` hasta la Fase 52; se migraron a Markdown el 2026-09-06.
Los originales quedan congelados en [`_baseline/`](_baseline/).

## Registro de decisiones y estado

- **[../GAPS.md](../GAPS.md)** — el ledger: cada vacío o decisión de dominio (G1–G30), por qué, qué se decidió, y a qué documento se integró. Lo único pendiente son 3 items bloqueados por proveedores externos.
- **[DOMINIO_PENDIENTE.md](DOMINIO_PENDIENTE.md)** — *retirado*. Análisis de Fase 28; sus conclusiones están en `DDD.md` §X y `UX_FLOWS.md` Parte 3.
- **[UI_UX_BACKLOG.md](UI_UX_BACKLOG.md)** — *journal* de la implementación de UI/UX. El estado vigente está en `UX_FLOWS.md` Parte 3; quedan 3 pulidos P2/P3 sueltos.

## Operación

- **[CORRER_EN_LOCAL.md](CORRER_EN_LOCAL.md)** — arrancar todo desde cero (local).
- **[DESPLIEGUE.md](DESPLIEGUE.md)** — hospedar: Expo → Render → Neon, $0/mes.
- **[../api/db/README.md](../api/db/README.md)** — base de datos, migraciones.

## Análisis de diseño (artefactos, no canónicos)

- **[mockup/](mockup/)** — mockup navegable, propuesta de rediseño, mapa de IA, casos de dominio probados contra el backend.
