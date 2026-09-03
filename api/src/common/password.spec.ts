import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('genera un hash con el formato scrypt$salt$hash', async () => {
    const hash = await hashPassword('secreta123');
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hashPassword('secreta123');
    expect(await verifyPassword('secreta123', hash)).toBe(true);
    expect(await verifyPassword('otra', hash)).toBe(false);
  });

  it('dos hashes de la misma contraseña difieren (salt distinto)', async () => {
    expect(await hashPassword('x')).not.toBe(await hashPassword('x'));
  });

  it('rechaza un hash con formato inválido sin lanzar', async () => {
    expect(await verifyPassword('x', 'no-es-un-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$a$b')).toBe(false);
  });
});
