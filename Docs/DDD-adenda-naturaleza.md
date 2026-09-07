# Adenda — Naturaleza de Deuda/Crédito (`FINANCIERA` | `CUSTODIA_INFORMAL`)

**Fase 50 · GAPS.md G28 · migración 023**

Los `.docx` (`DDD.docx`, `DATABASE_DESIGN.docx`) están congelados desde Fase 0; la
documentación viva del repo son `GAPS.md`, `DOMINIO_PENDIENTE.md`, las cabeceras
de `api/db/migrations/*.sql` y `api/db/init/01_schema.sql`. Esta adenda deja la
**prosa exacta** para incorporar a §T del DDD y a DATABASE_DESIGN cuando se
regeneren esos documentos.

---

## 1 · Para DDD.docx — Sección T, "Deuda / Crédito (especialización de Elemento Patrimonial)"

Añadir, después del párrafo que dice *"Deuda y Crédito son elementos
patrimoniales, no un agregado nuevo…"* y antes de la tabla de comandos
(`CondonarDeuda` / `DeclararIncobrable`):

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

## 2 · Para DATABASE_DESIGN.docx — tabla `elemento_patrimonial`

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

## 3 · Impacto en la app

- Wizard "Agregar cuenta o bien" (paso 2, solo si la categoría es Deuda/Crédito):
  segmento **Financiera / Encargo o custodia**.
- Patrimonio → sección Deudas / Créditos por cobrar: los `CUSTODIA_INFORMAL` se
  listan bajo el grupo **"Encargos y custodia"**, separados de las financieras.
- Detalle del elemento: fila "Tipo: Encargo o custodia".
- `ElementoPatrimonialDTO.naturaleza: string | null` (API y `app/src/api/client.ts`).
