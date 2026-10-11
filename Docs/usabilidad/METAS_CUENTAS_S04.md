# Metas con cuentas dedicadas — Sesión 04

**Ubicación en el repo:** `Docs/usabilidad/METAS_CUENTAS_S04.md`
**Fecha:** 2026-10-10 · **Línea base:** `main` en `8cb95bf` · **Estado:** propuesta aprobada (las 5 preguntas de §3 respondidas, 2026-10-11). Se implementa después del Bloque 2 de `LENTE_HOGAR_S04.md`.

## 0. Problema

Hoy una meta avanza solo con **apartados fijos**: `reserva.monto` se guarda en
el momento de "Ahorrar" y no cambia. Cuando alguien aparta **toda** una cuenta
que cambia de valor (un fondo mutuo, una cuenta en dólares) para una meta, la
meta no sigue a la cuenta.

## 1. Diagnóstico (prueba local, 2026-10-10)

Usuario nuevo en la base local, fondo mutuo de 1.000.000, meta "Casa propia"
de 2.000.000. Se aparta todo el fondo con `AhorrarParaObjetivo` (origen y
destino = el fondo) y después se valoriza la cuenta (`RegistrarValorizacion`).

| Momento | Valor del fondo | Progreso de la meta | Libre del fondo |
|---|---|---|---|
| Inicio | 1.000.000 | 0 | 1.000.000 |
| Apartado todo el fondo | 1.000.000 | 1.000.000 | 0 |
| El fondo sube | 1.200.000 | **1.000.000** (no cambia) | **200.000** |
| El fondo baja | 800.000 | **1.000.000** (no cambia) | **−200.000** |

Se confirma la sospecha:

- **El progreso queda congelado** en lo apartado:
  `progresoDeObjetivo = Σ reserva.monto` (`api/src/planificacion/progreso.service.ts`).
- **Lo libre puede quedar negativo**: `disponibilidad = valor_vigente − Σ reservas`.
  Con el fondo en 800.000, intentar apartar 1 peso más responde
  `409 El elemento solo tiene -200000 disponible`.
- **Al subir, la ganancia queda "libre"**: los 200.000 aparecen como plata
  disponible (para gastar o apartar para otra meta), aunque la persona quería
  toda la cuenta para la meta.
- El invariante del DDD ("la suma reservada no puede exceder la disponibilidad
  de sus fuentes", §Invariantes) se cumple al crear la reserva, pero una
  valorización a la baja lo rompe sin aviso.

Script de la prueba: `scratchpad/m-diag.sh` (no versionado; se puede repetir
contra la base local con un usuario nuevo).

## 2. Propuesta: "🏦 Esta cuenta es para esta meta"

### 2.1 Reglas

| # | Regla |
|---|---|
| M-1 | Una meta puede tener **varias cuentas dedicadas**. |
| M-2 | **Progreso = apartados fijos + valor actual de sus cuentas dedicadas.** Sube y baja con la cuenta; la política "Completar objetivo" se evalúa también al valorizar o mover una cuenta dedicada (solo completa, nunca revierte, como hoy). |
| M-3 | Una cuenta dedicada es **toda** de su meta: no se puede apartar para otra meta, y su libre es 0 (no suma a "Puedes gastar hoy"). |
| M-4 | La cuenta muestra **"🎯 Es para: [meta]"**. |
| M-5 | Solo se dedican cuentas que pueden tener plata para una meta: `LIQUIDEZ`, `RESERVA` e `INVERSION` (las mismas de "Ahorrar"; no `DEUDA`, `CREDITO` ni `ACTIVO`), en la **moneda de la meta**. |
| M-6 | Lo que sale de una cuenta dedicada (gasto o transferencia) baja el progreso solo, sin preguntar "¿Sale de una meta?": toda la cuenta es de la meta. |
| M-7 | Meta del hogar: solo se dedica una cuenta cuyo **saldo** vea el hogar (nivel "Que vean el saldo" o "Todo"); si no, el progreso de la meta mostraría un saldo privado. |

### 2.2 Cambio de dominio

**Opción recomendada: tabla propia del agregado Objetivo.**

```sql
-- 030_objetivo_cuenta_dedicada.sql
CREATE TABLE objetivo_cuenta_dedicada (
    objetivo_id UUID NOT NULL REFERENCES objetivo_financiero(id) ON DELETE CASCADE,
    elemento_id UUID NOT NULL REFERENCES elemento_patrimonial(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (objetivo_id, elemento_id),
    UNIQUE (elemento_id)            -- M-3: una cuenta, una sola meta
);
```

- **Por qué tabla y no columna** (`elemento_patrimonial.objetivo_dedicado_id`):
  la dedicación es una decisión sobre la meta (agregado Objetivo), no un dato
  de la cuenta; con tabla, el comando no modifica el agregado Elemento. La
  columna sería más simple (un `ALTER TABLE` y la unicidad sale sola); si Juan
  prefiere lo simple, es una alternativa válida.
- Sin cambios en `reserva` ni `asignacion`.

**Comandos nuevos** (`POST /comandos/...`):

| Comando | Validaciones | Efecto | Auditoría |
|---|---|---|---|
| `DedicarCuentaAObjetivo { objetivoId, elementoId }` | Actor dueño de la cuenta y con permiso sobre la meta (dueño o designado) · M-5 (categoría y moneda) · la cuenta no está dedicada a otra meta · no tiene reservas ACTIVAS de **otras** asignaciones (si tiene, se pide liberarlas antes) · M-7 en metas del hogar | Crea la fila. Las reservas ACTIVAS **de esta misma meta** sobre esa cuenta se liberan en la misma transacción (ahora las cubre el valor de la cuenta). Recalcula progreso y evalúa "Completar objetivo". | Creación: meta, cuenta, valor de la cuenta al dedicar, reservas liberadas (encadenadas al comando raíz, como `AhorrarParaObjetivo`). |
| `QuitarCuentaDeObjetivo { objetivoId, elementoId, conservarComoApartado: boolean }` | Actor con permiso sobre la meta o dueño de la cuenta | Borra la fila. Si `conservarComoApartado`, crea una reserva fija por el valor actual (el progreso no baja de golpe). | Eliminación: meta, cuenta, valor al quitar, reserva creada si la hubo. |

**Cambios en lo que existe:**

- `ProgresoService.progresoDeObjetivo`: suma también `valor_vigente` de las
  cuentas dedicadas activas. `disponibilidad(elemento)`: 0 si la cuenta está
  dedicada.
- `ReservaService.crear` / `AhorrarParaObjetivo`: rechazan una cuenta dedicada
  como origen (`CUENTA_DEDICADA`). Si la meta tiene cuenta dedicada y es el
  destino, "Ahorrar" solo transfiere (sin reserva): el valor de la cuenta ya
  cuenta.
- `RegistrarValorizacion` y los eventos que impactan una cuenta dedicada:
  recalculan el progreso de su meta y evalúan "Completar objetivo".
- `EliminarObjetivoFinanciero`: borra sus dedicaciones (cascada) y la cuenta
  queda libre. Desactivar la cuenta (cerrarla): deja de contar.
- DTOs: el objetivo trae `cuentasDedicadas [{ elementoId, nombre, valor }]`,
  `progresoApartado` y `progresoCuentas`; el elemento trae
  `dedicadaA { objetivoId, nombre } | null`.
- Patrimonio individual (`proyecciones.service`): el valor de una cuenta
  dedicada va en "Guardado para metas" y no en "Puedes gastar hoy".
- Documentos: `DDD.md` (Objetivo e invariante de Reserva), `APPLICATION_SERVICES.md`
  (2 comandos), `DATABASE_DESIGN.md` y `API_DESIGN.md`; gap nuevo en `GAPS.md`.

### 2.3 Convertir los apartados de "cuenta completa" que ya existen

No hay una marca de "cuenta completa" en la base: son reservas cuyo monto era
todo el saldo al apartar. **No se convierten solas** (sería adivinar la
intención). Propuesta:

1. **Detección** (consulta de solo lectura, también para revisar Neon): cuentas
   `RESERVA`/`INVERSION`/`LIQUIDEZ` con reservas ACTIVAS de **una sola meta**
   cuya suma sea ≥ 95 % del `valor_vigente`, o lo supere (libre negativo).
2. **Pregunta en la app**, una vez, en la meta: "🏦 ¿Toda la cuenta [Fondo]
   es para [Casa propia]?" — **Sí** ejecuta `DedicarCuentaAObjetivo` (que libera
   esas reservas en la misma transacción); **No** no vuelve a preguntar
   (preferencia guardada por cuenta).
3. Sin migración de datos: la migración 030 solo crea la tabla.

### 2.4 Pantallas

| Pantalla | Cambio |
|---|---|
| Meta (`ObjetivoDetalleScreen`) | Sección **"🏦 Cuentas de esta meta"** con cada cuenta y su valor de hoy; el avance se explica como una suma que cuadra: "🐷 Apartado X + 🏦 Cuentas Y = Z". Acción **"➕ Esta cuenta es para esta meta"** (hoja `Elegir` con las cuentas que cumplen M-5/M-7). La pregunta de §2.3 cuando corresponda. |
| Cuenta (`ElementoDetalleScreen`) | Pastilla **"🎯 Es para: [meta]"** (abre la meta). En vez de "🐷 Guardado para metas − X", "🎯 Toda la cuenta es para [meta]"; sin "libre". |
| Ajustes de la cuenta | Fila **"🎯 ¿Esta cuenta es para una meta?"** → `Elegir` (Ninguna / metas en camino); al quitar, la pregunta "¿Dejar lo que tiene como apartado?". |
| Ahorrar (`AhorrarScreen`) | Las cuentas dedicadas no aparecen como origen con "libre" (dicen "🎯 Es para [meta]"); si la meta tiene cuenta dedicada, es el destino por defecto y el pie dice "Pasa a [cuenta]: todo lo que tenga cuenta para la meta". |
| Agregar cuenta (C1) | Opcional, al final: "🎯 ¿Esta cuenta es para una meta?" (solo si hay metas en camino en esa moneda). |
| Planificar / Inicio | Sin cambios de pantalla: "Guardado para metas" y el progreso ya leen el progreso nuevo. |

## 3. Preguntas para Juan

**Respondidas (Juan, 2026-10-11):**
- **Tabla propia**, no columna en la cuenta, con restricción única por cuenta
  (una cuenta se dedica a una sola meta) — §2.2 tal como está.
- Los apartados de "cuenta completa" **no se convierten solos**: la app
  pregunta una vez en la meta — §2.3 tal como está.

**Respondidas (Juan, 2026-10-11, segunda tanda):**
- **No se dedican bienes (`ACTIVO`).** M-5 queda igual.
- **Al quitar una cuenta de una meta**, se pregunta si conservar lo que tiene
  como apartado, **sin opción preelegida** (`QuitarCuentaDeObjetivo` exige
  `conservarComoApartado` explícito; la pantalla no marca ninguna).
- **Ahorro real en el presupuesto** (`porObjetivo`): lo **transferido** a las
  cuentas dedicadas en el período, **neto de retiros**; la valorización no
  cuenta. Se suma a las reservas creadas en el período, como hoy.
- **Sin aviso** cuando una cuenta dedicada baja de valor. La meta muestra el
  cambio del mes por el valor de sus cuentas: "📉 −X este mes" (o "📈 +X este
  mes"), junto a "🏦 Cuentas de esta meta".

Con esto no quedan preguntas abiertas: M se implementa después del Bloque 2
de `LENTE_HOGAR_S04.md`, en su propia rama, con la migración 030.
