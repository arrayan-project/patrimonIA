// `prisma db pull` borra la relación evento_financiero ⇄ categoria_movimiento
// cada vez que corre (colisiona con la auto-relación de categoria_movimiento
// consigo misma, migración 017). Este script la vuelve a agregar con un nombre
// explícito. Se ejecuta automáticamente después de `npm run prisma:pull`.
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../prisma/schema.prisma', import.meta.url);
let s = readFileSync(path, 'utf8');

if (s.includes('evento_financiero_categoria')) {
  console.log('fix-schema-relations: relación ya presente, nada que hacer.');
  process.exit(0);
}

// Lado evento_financiero: después de la relación `asignacion`.
s = s.replace(
  /( {2}asignacion {2,}asignacion\?[^\n]*\n)/,
  '$1  categoria_movimiento            categoria_movimiento?  @relation("evento_financiero_categoria", fields: [categoria_id], references: [id], onDelete: NoAction, onUpdate: NoAction)\n',
);

// Lado categoria_movimiento: después de la relación `hogar`.
s = s.replace(
  /(model categoria_movimiento \{[\s\S]*?\n {2}hogar {2,}hogar {2,}@relation\(fields: \[hogar_id\][^\n]*\n)/,
  '$1  evento_financiero          evento_financiero[]    @relation("evento_financiero_categoria")\n',
);

writeFileSync(path, s);
console.log('fix-schema-relations: relación evento_financiero ⇄ categoria_movimiento re-agregada.');
