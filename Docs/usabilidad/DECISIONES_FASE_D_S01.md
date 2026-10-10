# Decisiones de la Fase D: Sesión 01 (bloque 1 de G33)

> **Estado (2026-10-10):** todas las decisiones de este documento (D-1 a D-7) están implementadas en la Fase E de G33 (`GAPS.md`, G33); la línea "Ninguna decisión está implementada" de abajo es de su fecha.

**Objetivo de este archivo:** registrar las decisiones D-1 a D-7, el caso borde
de HZ-11 y el tratamiento de M9/M7, aprobadas por Juan en el chat. Es la
entrada del bloque 2 de la Fase D (prototipo) y la especificación de la
Fase E.

- **Ubicación en el repo:** `Docs/usabilidad/DECISIONES_FASE_D_S01.md`
- **Fecha:** 2026-09-29 · **Entradas:** `USABILIDAD_REAL_S01.md` §9,
  `BENCHMARK_S01.md` §2, §4 y §6.
- **Estado:** ✅ bloque 1 cerrado. Ninguna decisión está implementada.

---

## 1. Decisiones cerradas

| # | Decisión | Qué se aprobó | Impacto en dominio |
|---|----------|---------------|--------------------|
| D-1 | Ahorrar para una meta | Servicio de aplicación `AhorrarParaObjetivo`: una transacción y una auditoría encadenada; acepta **N orígenes** (cubre A2). Si origen = destino, solo reserva (A6). La cuenta de destino de la meta **no se persiste**: se pregunta la primera vez y después se deriva de la cuenta con reserva hacia esa meta. | Orquestación |
| D-2 | Qué compartes con el hogar | Una pregunta con 4 niveles: **Nada · Que puedan transferirme · Que vean el saldo y sume al hogar · Todo (también movimientos)**. Combinaciones raras en "Avanzado". Si se omite al crear: **"Que puedan transferirme"**. Cuentas existentes que no calzan con un nivel: "Personalizado". | Ninguno (valores por defecto y presentación) |
| D-3 | Plata de otra persona | Servicio `RegistrarPlataDeOtraPersona` con la opción (b) de `BENCHMARK_S01.md` §4: la Deuda o el Crédito nace con pendiente 0 **solo dentro de esta orquestación**, junto con la TRANSFERENCIA que lo origina. Puertas: intención en el menú `+` y "¿Era plata de otra persona?" en Gasto e Ingreso. La persona se elige de la lista de saldos existentes o "Nueva persona"; **nunca por texto libre**. | DOMINIO (HZ-11): invariante `valorPendiente > 0` admite 0 solo en esta orquestación |
| D-3 · borde | Saldo que cruza de signo | Si un movimiento supera el saldo existente, la orquestación salda ese elemento a 0 y abre o aumenta el opuesto en la misma transacción. La UI muestra **un solo saldo con signo** ("Noira te debe 5.000"). Los elementos en 0 no se desactivan (se reúsan) y se ocultan de la lista mientras estén en 0. | Incluido en la orquestación de D-3 |
| D-4 | Palabras | Diccionario de §2. Se retira de la superficie "Apartados sin objetivo"; las reservas existentes sin objetivo se muestran en un grupo "Ahorro sin meta" (nombre ajustado en la Fase E, bloque 1), sin entrada para crear ni para agregarles plata. | Ninguno |
| D-5 | Destino de otro miembro | Plantillas **y** programados aceptan como destino una cuenta de otro miembro con la misma regla de TRANSFERENCIA (G6): nivel ≥ "Que puedan transferirme". El origen sigue siendo propio. | DOMINIO: relajar G24 (plantillas) y G2 (programados) |
| D-6 | Recurrencia | Los programados tienen periodicidad (mensual / anual), día y categoría. **No se registran solos:** en la fecha llega un aviso "¿Se pagó?"; al confirmar se puede ajustar el monto; sin respuesta queda pendiente. Las plantillas se muestran como "Frecuentes". | DOMINIO (HZ-16): campos nuevos en `MovimientoProgramado` |
| D-7 | Solicitud de aporte (M7) | Notificación con acción (Principio 4), tipo nuevo `SOLICITUD_APORTE`. Quien pagó registra el gasto y responde "¿Lo compartes con tu pareja?"; la pareja toca "Transferir" y llega a la transferencia prellenada; puede confirmar o rechazar; quien pagó ve "pendiente / pagado". Si la cuenta de quien pagó no permite recibir, se le pide subir su nivel (D-2). | Tipo de notificación nuevo; comandos intactos |

**Implementación de D-7 (2026-10-08, decisión de Juan):** la solicitud se
guarda en una tabla de apoyo, `solicitud_transferencia`, en vez de solo en la
notificación, para que tenga estado ("pendiente / pagado") y no se pierda si el
usuario silencia el aviso. No es un agregado ni mueve saldos, y los comandos
del dominio siguen intactos: se agregan 4 orquestaciones. Detalle en
`GAPS.md`, G33, bloque 9.

## 2. Diccionario de superficie (D-4)

| Término actual | Término nuevo |
|----------------|---------------|
| Objetivo | Meta |
| Apartar, reserva, asignación | Ahorrar / "en la meta" |
| Liberar | Sacar de la meta |
| Disponible | Libre para gastar |
| Origen / destino | Desde qué cuenta / A qué cuenta |
| Valor inicial | Saldo actual (cuentas) · Valor actual (bienes) · Lo que debes hoy (deudas) |
| Apartados sin objetivo | Ahorro sin meta (solo los que ya existen) |
| Materializar | Confirmar pago |
| Anular | Eliminar |

Los comandos de dominio mantienen su nombre literal (BUILD_INSTRUCTIONS §4).
Solo cambia el texto visible. "Eliminar" sigue siendo el comando
compensatorio `AnularEventoFinanciero`, así que el historial no se pierde.

## 3. M9 y M7: atribución del gasto por persona

**Decisión:** fuera de alcance mientras no haya evidencia contraria.

**Razón:** el objetivo declarado por Juan es que **los saldos individuales
cuadren y reflejen la realidad del hogar**. El modelo actual ya lo cumple
(igual que el Excel que usan hoy: transferencia entre miembros + gasto de quien
paga). Atribuir el gasto por persona es otro objetivo, no pedido.

**Límite conocido:** en la vista "Míos", el gasto completo aparece en quien
pagó (M9: Zoily 200.000; M7: el que pagó el total). El total del hogar es
correcto. Afecta sobre todo a un presupuesto individual (P1).

**Reapertura:** solo si en la Fase E Zoily o Juan reportan que sus números
personales no calzan. Camino barato si hiciera falta: una etiqueta informativa
("100.000 eran de Juan") sin tocar saldos. Referencias: `BENCHMARK_S01.md` y
el modelo "participación" de Splitwise/Tricount.

## 4. Orden de la Fase E

1. **D-4** (diccionario): todas las pantallas lo usan.
2. **HZ-13** (A5: gastar desde la meta): backend listo.
3. **C1 + D-2** (alta de cuenta y compartir con el hogar).
4. **D-1** Ahorrar (A1/A2).
5. **D-3** Plata de otra persona (M8/M10, incluye HZ-11).
6. **D-7** Solicitud de aporte (M7).
7. **D-5 + D-6** Recurrencia y destino de otro miembro (M5/H3).

## 5. Siguiente: bloque 2 de la Fase D (prototipo)

- **Objetivo:** prototipo interactivo, abrible en el teléfono, con C1 como
  entrada, el menú `+` de intenciones y los flujos Ahorrar (A1/A2), Compartido
  con la pareja (M7) y Plata de otra persona (M8), más M1.
- **Responsable:** Claude en el chat.
- **Señal:** Zoily completa **M1, M8, A1 y M7** sola en el prototipo.

## 6. Instrucciones para Claude Code (registro, directo a `main`)

**Tarea 6: Registrar el bloque 1 de la Fase D.** Sin cambios de código.
- Guardar este archivo en `Docs/usabilidad/DECISIONES_FASE_D_S01.md` y
  agregarlo al índice de `Docs/README.md`.
- `USABILIDAD_REAL_S01.md`:
  - §9: marcar D-1 a D-7 como **cerradas**, cada una con una línea y un enlace
    a §1 de este archivo;
  - §0: estado de la Fase D = "▶ Bloque 1 (decisiones) cerrado; bloque 2
    (prototipo) siguiente";
  - §11: actualizar pendientes.
- `GAPS.md`, bajo G33:
  - D-1 a D-7 pasan de `📋 DECISIÓN` a decisión cerrada, con referencia a este
    archivo;
  - especificar como `DOMINIO` pendiente de implementar en la Fase E: HZ-11
    (invariante en la orquestación de D-3), D-5 (G24 y G2) y D-6 (campos
    nuevos de `MovimientoProgramado`);
  - registrar M9/M7 (atribución por persona) como **fuera de alcance**, con la
    condición de reapertura de §3.
- **No implementar nada.** Las decisiones se implementan en la Fase E, en el
  orden de §4.
- *Señal:* un commit en `main` con los documentos y `git diff` sin cambios de
  código.
- *Rollback:* `git revert` del commit.
