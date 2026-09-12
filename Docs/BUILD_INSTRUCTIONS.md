# Instrucciones de construcción — PatrimonIA

> **Migrado de `.docx` a Markdown el 2026-09-06** (el original está en `Docs/_baseline/`). Este `.md` es ahora la fuente de verdad; las decisiones posteriores a Fase 0 se integran aquí y se registran en `GAPS.md`.

**Objetivo:** la capa operativa entre el diseño (documentos de `diseño/`) y la
implementación. No repite decisiones de dominio, API o base de datos — las
referencia. Su función es dar el "cómo" que los documentos de diseño no
cubren: stack, estructura, y qué hacer ante ambigüedad (§4, la parte que
sigue vigente). Su §3 ("Orden de construcción") describe solo Fase 0/1 —
es historia congelada del arranque del proyecto, no un roadmap actualizado;
el estado real de cada fase está en `../README.md`.

## 1. Documentos fuente (leer en este orden antes de escribir código)

1. `DDD.md` — modelo de dominio, agregados, invariantes, comandos, auditoría. Fuente de verdad de reglas de negocio.
2. `APPLICATION_SERVICES.md` — un caso de uso por comando de la Sección T. Cada uno define input, validaciones, orquestación, output.
3. `DATABASE_DESIGN.md` — modelo relacional lógico, con justificación de cada decisión de esquema.
4. **`../api/db/init/01_schema.sql`** — DDL PostgreSQL ejecutable (la traducción viva de DATABASE_DESIGN). `../api/db/migrations/*.sql` es la historia incremental. `Docs/_baseline/schema.sql` es la versión Fase 0, congelada.
5. `API_DESIGN.md` — contrato de API: `POST /comandos/{Nombre}` para mutaciones, REST para consultas.
6. `UX_FLOWS.md` — flujos end-to-end, arquitectura de información y desgloses de pantalla.

Regla de precedencia: si algo en este documento de instrucciones contradice cualquiera de los documentos fuente, los documentos fuente mandan. Este documento es operativo, no de dominio.

> **Nota (2026-09-06):** los 6 documentos fuente se migraron de `.docx` a Markdown.
> Los `.docx` originales de Fase 0 quedan en `Docs/_baseline/` como referencia
> histórica y ya no se editan. El registro de qué cambió respecto de la Fase 0
> está en `GAPS.md` (G1–G30).

## 2. Stack técnico (decisión ya tomada, no reabrir)

- Backend: Node.js + TypeScript + NestJS.
- Base de datos: PostgreSQL (esquema en `../api/db/init/01_schema.sql`, migraciones en `../api/db/migrations/`).
- Cliente: React Native con Expo.
- ORM sugerido: Prisma (coherente con TS end-to-end, buen soporte de constraints/tipos generados desde el schema) — si Claude Code tiene una razón técnica de peso para preferir otro (TypeORM, Drizzle), debe exponerla antes de decidir, no decidir en silencio.

## 3. Orden de construcción

Regla general: construir vertical, no horizontal. No se construye “todo el backend” y luego “todo el frontend” — se construye un flujo completo de punta a punta, funcionando, antes de pasar al siguiente.

### Fase 0 — Setup de proyecto

- Repo con estructura backend (`/api`) y móvil (`/app`) separados, o monorepo — decisión de Claude Code, justificada brevemente.
- Backend: proyecto NestJS inicializado, conexión a PostgreSQL configurada, `schema.sql` ejecutado contra una instancia real vía Docker (`docker run` con imagen `postgres:16` — no requiere Postgres instalado localmente en la máquina).
- Móvil: proyecto Expo inicializado, corriendo en simulador o dispositivo real.
- Validación de fase: backend responde a un healthcheck simple; app Expo abre y muestra una pantalla en blanco. Nada de lógica de negocio todavía.

### Fase 1 — Esqueleto vertical: Flujo 2 (Alta de hogar)

Implementar de punta a punta, siguiendo `UX_FLOWS.md` sección “Desglose — Flujo 2”:

- Backend: los Application Services #34 (CrearHogar), #37 (InvitarMiembro), #38 (AceptarInvitacion), #39 (RechazarInvitacion), #43 (RegistrarUsuario) — con sus endpoints correspondientes de `API_DESIGN.md`. Incluye la tabla `auditoria` funcionando desde el primer comando (no se pospone “para después” — es parte del contrato de cada Application Service).
- Móvil: las pantallas de Registro, Bienvenida/Elegir camino, Crear Hogar, Ingresar código/ver invitaciones — tal como están descritas en el desglose de pantallas.
- Validación de fase: un usuario puede registrarse, crear un hogar, invitar a otro usuario (de prueba), y ese usuario puede aceptar — todo desde la app, contra el backend real, con las filas correspondientes verificables en `auditoria`.

### Fase 2 en adelante — no se detalla aquí

Se define al cerrar la Fase 1, según qué se aprenda de ese primer ciclo completo. No hay que planificar todas las fases de antemano — eso sería repetir la misma cadena de pretareas contra la que se viene trabajando, aplicada ahora a nivel de plan de construcción.

## 4. Qué hacer ante un vacío o ambigüedad

Este es el punto más importante del documento. Los 2 vacíos originales de Fase 0
**ya se resolvieron** (estado operativo de Deuda/Crédito → 6 estados derivados,
`GAPS.md` G1; visibilidad de Movimiento Programado → hereda del elemento, G2).
El registro completo de vacíos y decisiones está en **`GAPS.md`** (G1–G30); lo
único abierto son 3 integraciones externas (G4, G20-push, G21-import).

Si Claude Code encuentra un vacío nuevo, no listado en `GAPS.md`, la regla es:

- No decidir en silencio. Detener la implementación de esa pieza específica, documentar el vacío con el mismo formato usado en `UX_FLOWS.md` (qué se necesita, por qué no está resuelto, qué opciones existen), y continuar con otra parte del trabajo que no dependa de esa decisión.
- No inventar una regla de negocio nueva para rellenar el vacío, aunque parezca trivial. Ejemplo de lo que NO hacer: si no está claro qué pasa al eliminar un usuario con deudas activas, no asumir un comportamiento — señalarlo.
- Esto aplica con más fuerza a decisiones de dominio (afectan `DDD.md`) que a decisiones puramente técnicas (ej. qué librería de validación de formularios usar en Expo) — estas últimas Claude Code puede decidirlas y simplemente justificarlas brevemente en el commit o README.

## 5. Convenciones de código

- Nombres: los nombres de comando (`RegistrarElementoPatrimonial`, etc.) se mantienen literales en el código — en el nombre del endpoint, en el nombre de la clase/función del Application Service, y en el campo `comando` de la tabla `auditoria`. No traducir ni renombrar a convención REST/CRUD (evitar `createElement`, usar `registrarElementoPatrimonial` o el nombre de clase equivalente) — la trazabilidad 1:1 entre DDD → Application Services → API → código es el activo más valioso de todo este trabajo de diseño, y se pierde si el código usa nombres distintos a los del dominio.
- Auditoría no es opcional ni se pospone. Cada Application Service que ejecuta un comando debe escribir su entrada de auditoría como parte de la misma transacción — no como un paso “para agregar después”. Ver `DDD.md` Sección U para la regla de campos condicionales y encadenamiento.
- Patrón de corrección/compensación (Evento Financiero, Valorización, Ajuste Patrimonial): nunca UPDATE de una fila ya creada — siempre INSERT de una fila nueva enlazada vía `correccion_de_id`. Este patrón está en 3 tablas distintas y debe implementarse de forma idéntica en las 3, no reinventado cada vez.
- Validaciones de invariantes que no son CHECK de SQL (ej. “al menos un propietario”, “suma de % = 100%”) viven en la capa de Application Service, dentro de la misma transacción que la escritura — nunca solo en el cliente/frontend. Ver `DATABASE_DESIGN.md`, tablas de “Invariantes → mecanismo” de cada agregado, para la lista completa.

## 6. Qué NO se construye en la Fase 1 (alcance explícito)

Para que Claude Code no se desvíe hacia otros agregados antes de cerrar el esqueleto vertical: en Fase 1 no se toca Elemento Patrimonial, Evento Financiero, Valorización, Ajuste Patrimonial, Asignación/Reserva, Objetivo Financiero, Presupuesto, ni Deuda/Crédito. Esos son los siguientes ciclos verticales, uno a la vez, después de que Flujo 2 esté funcionando de punta a punta y validado.
