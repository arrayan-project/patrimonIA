import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  let rl: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    rl = new RateLimiter();
  });
  afterEach(() => vi.useRealTimers());

  it('permite hasta `maximo` y luego bloquea', () => {
    for (let i = 0; i < 3; i++) expect(rl.permitir('ip', 3, 1000)).toBe(true);
    expect(rl.permitir('ip', 3, 1000)).toBe(false);
  });

  it('la ventana se desliza: pasado el tiempo, vuelve a permitir', () => {
    for (let i = 0; i < 3; i++) rl.permitir('ip', 3, 1000);
    expect(rl.permitir('ip', 3, 1000)).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rl.permitir('ip', 3, 1000)).toBe(true);
  });

  it('las claves son independientes', () => {
    for (let i = 0; i < 3; i++) rl.permitir('a', 3, 1000);
    expect(rl.permitir('a', 3, 1000)).toBe(false);
    expect(rl.permitir('b', 3, 1000)).toBe(true);
  });
});
