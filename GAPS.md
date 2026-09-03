# Vacíos y decisiones pendientes

Formato tomado de `Docs/UX_FLOWS.docx` § "Resumen y vacíos detectados": qué se
necesita, por qué no está resuelto, qué opciones existen. Nada de esto se
resuelve inventando una regla de negocio (BUILD_INSTRUCTIONS §4).

---

## Heredados del diseño (documentados en los 6 docs, NO tocados en Fase 1)

### G1 — Estado operativo intermedio de Deuda/Crédito
- **Qué falta**: un valor entre "activa" y "pagada por completo" para mostrar en UI.
- **Por qué no está resuelto**: la Sección T del DDD dice que el estado "se deriva
  del valor pendiente" pero no enumera los valores intermedios.
- **Opciones**: (a) cálculo trivial de UI — `% pagado = (monto_original - valor_pendiente) / monto_original`;
  (b) estado formal nombrado en el modelo.
- **Estado**: sin decidir. No implementar (a) como estado formal sin decisión
  explícita. Fase 1 no toca Deuda/Crédito.

### G2 — Visibilidad / propiedad de Movimiento Programado
- **Qué falta**: definir si `movimiento_programado` lleva columnas de
  visibilidad/propiedad propias o hereda las del elemento destino.
- **Por qué no está resuelto**: DDD Sección S lo deja explícitamente para después.
- **Estado**: sin decidir. No agregar columnas ni lógica sin decisión explícita.
  Fase 1 no toca Movimiento Programado.

---

## Detectados durante la implementación de Fase 1

### G3 — `moneda_consolidacion` en CrearHogar
- **Qué falta**: el esquema exige `hogar.moneda_consolidacion` (NOT NULL), pero
  el comando `CrearHogar` (API_DESIGN A / AS #34) solo define `nombre` como input,
  y la pantalla "Crear Hogar" (UX_FLOWS) solo pide el nombre.
- **Decisión provisional**: el DTO acepta `monedaConsolidacion` opcional; si no
  viene, se usa el placeholder `"CLP"` (`MONEDA_PLACEHOLDER` en `hogar.service.ts`).
  Ajustable después con `CambiarMonedaConsolidacion` (AS #36, aún no implementado).
- **Por qué es aceptable**: es el mismo patrón que BUILD_INSTRUCTIONS §4 autoriza
  para el % de Deuda/Crédito — placeholder trivial + comentario en código.
  Bloquear todo el flujo vertical por la moneda inicial sería desproporcionado.
- **Para decidir**: ¿la pantalla de alta debería pedir la moneda?, ¿o el default
  es una regla de producto legítima ("hogar chileno → CLP")?

### G4 — "Token de sesión temporal de registro" para RegistrarUsuario
- **Qué falta**: API_DESIGN dice que `POST /comandos/RegistrarUsuario` va con un
  "token de sesión temporal de registro, no de usuario ya autenticado". Ese
  pre-registro (pedir el token) no está modelado — no hay comando que lo emita.
- **Decisión provisional (técnica, no de dominio)**: el endpoint queda `@Public()`
  (sin JWT). Gatearlo tras un token que nadie puede obtener todavía bloquearía el
  alta por completo.
- **Para decidir**: diseñar el flujo de pre-registro (endpoint anónimo que emite
  un token de registro de corta duración, p. ej. tras un captcha o un email) —
  es infraestructura de auth, se puede resolver sin tocar el DDD.

### G5 — Consulta "mis invitaciones recibidas"
- **Qué falta**: la pantalla del invitado (UX_FLOWS Flujo 2, paso 4) necesita
  listar sus invitaciones pendientes, pero no conoce el `hogar_id`. API_DESIGN
  solo tiene `GET /hogares/{id}/invitaciones?estado=PENDIENTE` (por hogar).
- **Decisión**: se agregó `GET /usuarios/me/invitaciones?estado=PENDIENTE`,
  simétrico a `GET /usuarios/me/hogares` que sí existe.
- **Por qué es aceptable**: API_DESIGN § "Resumen de cobertura" dice que las
  consultas "no se cuentan 1:1 contra ningún catálogo... se diseñaron según
  necesidad de UI/dashboard razonable". No es un comando ni una regla nueva.
