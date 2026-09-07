# Adenda de dominio — Fases 50–51

**Fase 50 · GAPS.md G28 · migración 023 — `elemento_patrimonial.naturaleza`**
**Fase 51 · GAPS.md G29 · migración 024 — evento `SALDO_INICIAL`**

Los `.docx` (`DDD.docx`, `DATABASE_DESIGN.docx`) son la referencia de Fase 0; la
documentación viva del repo son `GAPS.md`, `DOMINIO_PENDIENTE.md`, las cabeceras
de `api/db/migrations/*.sql` y `api/db/init/01_schema.sql`. Esta adenda deja la
**prosa exacta** para §T del DDD y para DATABASE_DESIGN. El texto de las
secciones 1 y 4 se anexó también al final de `DDD.docx`, y el de las secciones 2
y 5 al final de `DATABASE_DESIGN.docx` (bloque "Adenda Fases 50–51").

---

## 1 · DDD.docx §T — Naturaleza de Deuda/Crédito

Añadir, después del párrafo *"Deuda y Crédito son elementos patrimoniales, no un
agregado nuevo…"* y antes de la tabla de comandos (`CondonarDeuda` /
`DeclararIncobrable`):

> **Naturaleza de la deuda/crédito.** Al registrar el elemento se declara su
> `naturaleza`:
>
> - **`FINANCIERA`** — un crédito o préstamo real: hipotecario, crédito de
>   consumo, saldo de tarjeta, un préstamo entre personas que se espera devolver
>   como obligación.
> - **`CUSTODIA_INFORMAL`** — dinero que solo pasa por las cuentas del usuario y
>   nunca fue suyo: un tercero le transfiere un monto para que le compre algo. El
>   neto patrimonial se comporta igual que una deuda (el dinero recibido no es
>   patrimonio propio), pero no es una obligación financiera: se "salda"
>   entregando lo comprado, no pagando.
>
> `naturaleza` es un **atributo del comando `RegistrarElementoPatrimonial`**
> cuando la categoría funcional es DEUDA o CREDITO (obligatorio para esas
> categorías, por defecto `FINANCIERA`; no aplica al resto). Se distingue desde
> el comando —y no mediante un flag interno de presentación— siguiendo el mismo
> criterio que `CondonarDeuda` vs `DeclararIncobrable`: si mañana se necesita
> tratamiento legal/contable diferenciado (p. ej. no informar la custodia como
> deuda del usuario), la distinción ya está en el modelo. No genera comando
> nuevo, no dispara políticas sobre el patrimonio y no altera el cálculo del
> valor vigente ni del estado operativo.

En la fila `RegistrarElementoPatrimonial` de la tabla de la **Sección E**
("Elemento Patrimonial"), columna "Qué registra auditoría", añadir al final:
*"… + naturaleza (solo DEUDA/CREDITO)"*.

---

## 2 · DATABASE_DESIGN.docx — tabla `elemento_patrimonial`

Añadir a la definición de columnas (junto a `valor_pendiente`,
`valor_pendiente_inicial` y el resto del detalle de DEUDA/CREDITO):

| Columna | Tipo | Nulo | Descripción |
|---|---|---|---|
| `naturaleza` | `TEXT` | Sí (NULL salvo DEUDA/CREDITO) | Naturaleza de una deuda/crédito: `FINANCIERA` (crédito/préstamo real) o `CUSTODIA_INFORMAL` (dinero de un tercero que solo pasa por las cuentas). Obligatoria para `categoria_funcional IN ('DEUDA','CREDITO')` — por defecto `'FINANCIERA'`; debe ser NULL en el resto de categorías. |

CHECK de fila (migración 023):

```sql
CONSTRAINT ck_naturaleza_valores CHECK (
    naturaleza IS NULL OR naturaleza IN ('FINANCIERA', 'CUSTODIA_INFORMAL')
),
CONSTRAINT ck_naturaleza_categoria CHECK (
    (categoria_funcional IN ('DEUDA', 'CREDITO') AND naturaleza IS NOT NULL)
    OR (categoria_funcional NOT IN ('DEUDA', 'CREDITO') AND naturaleza IS NULL)
)
```

Backfill al aplicar la migración: `UPDATE elemento_patrimonial SET
naturaleza = 'FINANCIERA' WHERE categoria_funcional IN ('DEUDA','CREDITO') AND
naturaleza IS NULL` (toda deuda/crédito preexistente es financiera).

---

## 3 · Impacto en la app (naturaleza)

- Wizard "Agregar cuenta o bien" (paso 2, solo si la categoría es Deuda/Crédito):
  segmento **Financiera / Encargo o custodia**.
- Patrimonio → sección Deudas / Créditos por cobrar: los `CUSTODIA_INFORMAL` se
  listan bajo el grupo **"Encargos y custodia"**, separados de las financieras.
- Detalle del elemento: fila "Tipo: Encargo o custodia".
- `ElementoPatrimonialDTO.naturaleza: string | null` (API y `app/src/api/client.ts`).

---

## 4 · DDD.docx §T — Saldo inicial como hecho económico (`SALDO_INICIAL`)

Añadir en §T, en la parte de "Elemento Patrimonial", junto a
`RegistrarElementoPatrimonial`:

> **El saldo inicial de una cuenta es un hecho económico.** Cuando se registra un
> elemento de categoría **LIQUIDEZ o RESERVA** con un `valorInicial > 0`, el
> comando `RegistrarElementoPatrimonial` crea —en la misma transacción— un
> `EventoFinanciero` de tipo **`SALDO_INICIAL`** y su `ImpactoPatrimonial`
> (`+valorInicial`, fecha = `fecha_alta` del elemento). El elemento nace con
> `valor_vigente = 0` y el impacto lo lleva a su valor: así la reconstrucción
> histórica de estas cuentas queda 100 % basada en impactos, sin un valor
> "sembrado" fuera del rastro de eventos.
>
> `SALDO_INICIAL` **no** se genera para INVERSION ni ACTIVO: el valor de apertura
> de un inmueble o un fondo mutuo no es un ingreso, es una valorización inicial.
>
> `SALDO_INICIAL` **no** es un comando disponible al usuario (no está en el
> catálogo de `RegistrarEventoFinanciero`), no se puede anular ni corregir; para
> ajustar un saldo de apertura mal cargado se usa un **Ajuste Patrimonial** sobre
> la cuenta.
>
> **Lecturas.** En `resumen-financiero` un `SALDO_INICIAL` suma a
> `porMoneda.ingresos` y al `balance`, y aparece como un rubro propio
> ("Saldo inicial"). En el **presupuesto** NO cuenta como ingreso del período
> (abrir una cuenta no es ingreso presupuestable): `presupuesto.service` solo
> considera INGRESO/GASTO. `patrimonio-individual` y la reconstrucción histórica
> no cambian su resultado.

En la Sección E, fila `RegistrarElementoPatrimonial`, columna "Efectos":
*"… + si categoría ∈ {LIQUIDEZ, RESERVA} y valorInicial > 0: evento
`SALDO_INICIAL` + impacto de apertura"*.

---

## 5 · DATABASE_DESIGN.docx — tabla `evento_financiero`

Columna `tipo` — ampliar el dominio de valores (migración 024):

| Antes | Ahora |
|---|---|
| `CHECK (tipo IN ('INGRESO','GASTO','TRANSFERENCIA','CONVERSION','PRESTAMO'))` | `CHECK (tipo IN ('INGRESO','GASTO','TRANSFERENCIA','CONVERSION','PRESTAMO','SALDO_INICIAL'))` |

`SALDO_INICIAL` — evento generado exclusivamente por
`RegistrarElementoPatrimonial` para la apertura de una cuenta LIQUIDEZ/RESERVA.
Un único impacto `+valorInicial` sobre el elemento recién creado, con
`fecha = fecha_alta`. No editable por comandos de evento.

---

## 6 · Reporte — transferencias visibles (F1, sin cambio de esquema)

`resumen-financiero.movimientos` ya no filtra TRANSFERENCIA/CONVERSION: se
devuelven como filas con `efectoPropio` (impacto neto sobre las cuentas propias
del alcance consultado, con signo). **No** contribuyen a `porMoneda` ni a
`porRubro` — el flujo del período sigue siendo solo INGRESO/GASTO + SALDO_INICIAL.
Ver `ResumenFinancieroDTO.movimientos[].efectoPropio` en `reporte.dto.ts`.
