# Cierre de la Fase D: Sesión 01 (G33)

**Objetivo de este archivo:** dejar registrado cómo terminó la Fase D: qué
mostró el prototipo, qué hallazgos nuevos aparecieron y qué se especifica para
la Fase E.

- **Ubicación en el repo:** `Docs/usabilidad/CIERRE_FASE_D_S01.md`
- **Fecha:** 2026-10-02 · **Entradas:** `DECISIONES_FASE_D_S01.md`,
  `BENCHMARK_S01.md`.
- **Prototipo:** <https://claude.ai/artifact/Q8exygRt8Ms4j5jT1B9UZM>
  (versión 5). Copia en el repo: `Docs/usabilidad/prototipo/prototipo-fase-d-s01.html`.
- **Precedencia:** en el menú `+` y en el paso 2 de Gasté y Recibí, **D-8
  (§4) manda sobre el prototipo v5**. En todo lo demás, manda el prototipo.
- **Estado:** ✅ **Fase D cerrada.**

---

## 1. Señal de validación

**Señal de §6 de `USABILIDAD_REAL_S01.md`:** Zoily completa M1, M8, A1 y M7
**sola** en el prototipo. **Cumplida**, con una advertencia: las pruebas 4 y 6
las completó en un segundo intento, cuando ya conocía los escenarios.

| # | Tarea | 1er intento | 2º intento | Observación |
|---|-------|-------------|------------|-------------|
| 1 | Agregar Falabella (C1) | ✅ | — | — |
| 2 | Helado (M1) | ✅ | — | — |
| 3 | Ahorrar Hogar (A1) | ✅ | — | — |
| 4 | Cortinas compartidas (M7a) | ❌ | ✅ | No encontró "compartido": estaba en el paso 6 y venía "Mío" ya elegido. En el 2º intento omitió el monto; la app se lo avisó y lo completó |
| 5 | Pagar supermercado (M7b) | ✅ | — | — |
| 6 | Labial de Noira (M8) | ❌ | ✅ | Anotó la entrada como ingreso y no tenía cómo corregirlo. En el 2º intento dudó por textos parecidos entre las opciones |

**Comparación con la primera prueba de la app real:** en esa no completó ningún
flujo. Ahora completó 6 de 6.

**Validez:** el prototipo valida la superficie, no las orquestaciones del
backend. La prueba definitiva es con la app real, en la Fase E.

## 2. Versiones del prototipo

| Versión | Origen | Cambio |
|---------|--------|--------|
| v1 | Bloque 2.1 | Diseño de partida de los cinco flujos |
| v2 | Prueba de Juan | Formularios propios en "Plata de otra persona"; listas de personas filtradas; una sola elección en "¿De quién es este gasto?"; saldos con personas sin color; "Libre para gastar" excluye la plata ajena; la pareja no se puede anotar como "otra persona" |
| v3 | Zoily | Numeración sutil de los pasos en los formularios |
| v4 | Pruebas 4 y 6 fallidas | "¿De quién es?" en el paso 2 de Gasté y de Recibí; intención "Gasto compartido con Juan" en el menú `+`; "Entre Juan y tú" en Hogar; recuperación de un ingreso mal anotado desde Gasté |
| v5 | Prueba 6 (2º intento) | "Plata de otra persona" agrupada por historia, con la dirección de la plata y ejemplos distintos |

## 3. Hallazgos nuevos

| ID | Tipo | Hallazgo | Para la Fase E |
|----|------|----------|----------------|
| HZ-18 | PROYECCIÓN | "Disponible" (que pasa a llamarse "Libre para gastar") incluye plata de terceros. Invita a gastar plata ajena | Restar del libre el total de deudas por plata de terceros (D-3), y avisar cuánta plata ajena hay en las cuentas |
| HZ-19 | UI | En tema oscuro no se percibe el orden de los pasos de un formulario | Numerar los pasos de forma sutil |
| HZ-20 | FLUJO | No hay cómo recuperarse de un registro mal clasificado (un ingreso que era plata de otra persona) | Corregir desde el flujo siguiente: anular el ingreso y registrarlo con D-3, en una sola transacción. Si no estaba anotado, registrar ambos hechos |
| HZ-21 | UI / PROYECCIÓN | No hay ningún lugar que muestre lo que pasa entre los miembros del hogar | "Entre [pareja] y tú" en Hogar: solicitudes (D-7) y transferencias entre miembros. Solo lectura; no reabre la atribución por persona |
| HZ-22 | UI | Una decisión de uso frecuente al final del formulario, con un valor ya elegido, no se descubre | Regla de diseño: la decisión que cambia el significado del registro va en el paso 2 |
| HZ-23 | UI | El menú con una puerta por caso ("Gasto compartido", cuatro variantes de "Plata de otra persona") no calza con cómo piensa la usuaria: **primero la dirección de la plata, después de quién era** (en la prueba 6 fue dos veces a Recibí). Además, no escala a un hogar con más miembros | Resuelto con D-8 |

## 4. D-8: Dos puertas y "¿de quién es?" (decisión nueva)

**Origen:** revisión de Juan después de la prueba, respaldada por HZ-23.
**Estado:** ✅ aprobada (2026-10-02).

**Decisión:** el menú `+` tiene una puerta por **dirección** de la plata. El
**paso 2** de Gasté y de Recibí pregunta **de quién es**. Desaparecen las
puertas "Gasto compartido" y "Plata de otra persona".

**Por qué alcanzan tres opciones:** las cuatro variantes de "Plata de otra
persona" son contablemente **solo dos operaciones**. Si entra plata de una
persona, su saldo contigo baja; si sale plata por una persona, su saldo
sube. Encargo, préstamo y devolución dan el mismo asiento: la app calcula el
resultado y lo dice en palabras ("Noira y tú quedan a mano", "Le debes
$30.000"). No se pregunta *por qué* entró o salió la plata.

### 4.1 Menú `+`

Gasté · Recibí · Moví plata (entre tus cuentas o a alguien del hogar) ·
Ahorrar para una meta · Pagar tarjeta (solo si hay tarjeta) · Agregar cuenta.

### 4.2 Gasté

Pasos: Cuánto → **¿De quién es este gasto?** → En qué → Categoría → Cuenta →
Fecha → ¿Sale de una meta? (contextual, solo con Mío o Compartido).

| Opción | Qué hace |
|--------|----------|
| **Mío** | GASTO normal |
| **Compartido con el hogar** | GASTO + solicitud de aporte (D-7). Si el hogar tiene un solo miembro aparte del usuario, viene elegido y el texto lo nombra ("Compartido con Juan"). Si hay más, se elige con quiénes y cuánto le toca a cada uno (por defecto, partes iguales) |
| **De otra persona** | Pagó por alguien, o usó o devolvió su plata: el saldo con esa persona sube (D-3). No es gasto del usuario |

**Pregunta extra, solo si hay ambigüedad:** con "De otra persona" y una
persona **sin saldo** (o nueva), la app pregunta: *"¿Te había pasado plata
antes?"*
- *Sí, la anoté como mía* → elige ese ingreso y se corrige (HZ-20).
- *No la anoté* → se registran los dos hechos en una transacción.
- *No, me la va a devolver* → queda como plata que te debe.

### 4.3 Recibí

Pasos: Cuánto → **¿De quién es esta plata?** → Qué fue → Cuenta → Fecha.

| Opción | Qué hace |
|--------|----------|
| **Mía** | INGRESO normal |
| **De alguien del hogar** | **No crea ningún evento.** Una TRANSFERENCIA entre miembros la registra quien la envía; si la registrara también quien la recibe, quedaría duplicada. Muestra las transferencias que el miembro ya registró hacia el usuario y, si la que busca no aparece, ofrece **"Avisarle a [miembro]"** (notificación, Principio 4) |
| **De otra persona** | El saldo con esa persona baja (D-3): queda como plata que le debes, o como devolución de lo que te debía. No es ingreso del usuario |

### 4.4 Lo que no cambia

- Saldos con personas en texto neutro, sin signo ni color.
- "Libre para gastar" excluye la plata ajena (HZ-18).
- "Entre [miembro] y tú" en Hogar (HZ-21).
- Numeración de pasos (HZ-19) y regla del paso 2 (HZ-22).
- Impacto en el dominio: **ninguno nuevo**. Son las mismas orquestaciones de
  D-3 y D-7, con otra entrada.

### 4.5 Validación y riesgo aceptado

D-8 **no fue probada con una usuaria sin contacto previo**. Zoily ya conoce
los escenarios y no hay otra persona disponible. **Juan acepta el riesgo:**
por ahora el hogar son solo ellos dos y la tolerancia es alta. Se valida
directamente en la app real, con la señal de la Fase E. **Reapertura:** si se
suma un usuario nuevo, se repiten con él las pruebas 4 y 6.

## 5. Orden de la Fase E (actualizado)

1. D-4 (diccionario) + HZ-19 (numeración) + HZ-22 (regla del paso 2).
2. HZ-13: gastar desde la meta (A5).
3. C1 + D-2: alta de cuenta y compartir con el hogar.
4. D-1: Ahorrar (A1/A2).
5. D-8 + D-3 (incluye HZ-11) + HZ-18 + HZ-20: el paso 2 "¿de quién es?" en
   Gasté y Recibí, plata de otra persona, libre para gastar sin plata ajena y
   recuperación.
6. D-7 + HZ-21: solicitud de aporte, "De alguien del hogar" en Recibí y
   "Entre [miembro] y tú".
7. D-5 + D-6: recurrencia y destino de otro miembro.

**Señal de la Fase E:** Zoily usa la app real durante un mes y completa sola
los mismos seis escenarios.

## 6. Instrucciones para Claude Code (registro, directo a `main`)

**Tarea 7: Registrar el cierre de la Fase D.** Sin cambios de código de la app.
- Guardar este archivo en `Docs/usabilidad/CIERRE_FASE_D_S01.md` y el
  prototipo en `Docs/usabilidad/prototipo/prototipo-fase-d-s01.html` (Juan
  adjunta el HTML). Agregar ambos al índice de `Docs/README.md`.
- `USABILIDAD_REAL_S01.md`: Fase D ✅ en §0; HZ-18 a HZ-23 en §4; D-8
  como cerrada en §9, con un enlace a §4 de este archivo; actualizar §11 con
  el orden de la Fase E de §5.
- `GAPS.md`, bajo G33: HZ-18 y HZ-21 como `PROYECCIÓN`, HZ-20 como `FLUJO`,
  HZ-19, HZ-22 y HZ-23 como `UI`, todos pendientes para la Fase E. D-8 como
  decisión cerrada, con el riesgo aceptado de §4.5.
- *Señal:* un commit en `main` con documentos y el HTML; `git diff` sin
  cambios en `apps/` ni en `packages/`.
- *Rollback:* `git revert` del commit.
