import { describe, expect, it } from 'vitest';
import { hoyChile, siguienteFecha } from './recurrencia.js';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const iso = (f: Date) => f.toISOString().slice(0, 10);

describe('siguienteFecha (D-6)', () => {
  it('mensual: el mismo día del mes siguiente, cruzando el año', () => {
    expect(iso(siguienteFecha(d('2026-10-05'), 'MENSUAL', 5))).toBe('2026-11-05');
    expect(iso(siguienteFecha(d('2026-12-05'), 'MENSUAL', 5))).toBe('2027-01-05');
  });

  it('mensual: un 31 cae en el último día de un mes corto y vuelve al 31', () => {
    const feb = siguienteFecha(d('2027-01-31'), 'MENSUAL', 31);
    expect(iso(feb)).toBe('2027-02-28');
    const mar = siguienteFecha(feb, 'MENSUAL', 31);
    expect(iso(mar)).toBe('2027-03-31');
    expect(iso(siguienteFecha(mar, 'MENSUAL', 31))).toBe('2027-04-30');
  });

  it('anual: el mismo día y mes del año siguiente; 29-feb cae en 28 y vuelve', () => {
    expect(iso(siguienteFecha(d('2026-03-15'), 'ANUAL', 15))).toBe('2027-03-15');
    const no = siguienteFecha(d('2028-02-29'), 'ANUAL', 29);
    expect(iso(no)).toBe('2029-02-28');
    expect(iso(siguienteFecha(d('2031-02-28'), 'ANUAL', 29))).toBe('2032-02-29');
  });
});

describe('hoyChile', () => {
  it('a las 23:30 UTC todavía es el mismo día en Chile', () => {
    expect(hoyChile(new Date('2026-10-08T23:30:00Z'))).toBe('2026-10-08');
  });
  it('a las 02:00 UTC sigue siendo el día anterior en Chile', () => {
    expect(hoyChile(new Date('2026-10-09T02:00:00Z'))).toBe('2026-10-08');
  });
});
