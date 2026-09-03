import { Injectable } from '@nestjs/common';

/**
 * Límite de tasa por clave, ventana deslizante en memoria. Suficiente para una
 * sola instancia; para varias haría falta un store compartido (Redis).
 * No es dominio — es protección de endpoints anónimos (GAPS.md G4).
 */
@Injectable()
export class RateLimiter {
  #hits = new Map<string, number[]>();

  /** true si la petición está permitida; false si excede `maximo` en `ventanaMs`. */
  permitir(clave: string, maximo: number, ventanaMs: number): boolean {
    const ahora = Date.now();
    const previos = (this.#hits.get(clave) ?? []).filter((t) => ahora - t < ventanaMs);
    if (previos.length >= maximo) {
      this.#hits.set(clave, previos);
      return false;
    }
    previos.push(ahora);
    this.#hits.set(clave, previos);
    if (this.#hits.size > 5000) this.#podar(ahora, ventanaMs);
    return true;
  }

  #podar(ahora: number, ventanaMs: number): void {
    for (const [k, ts] of this.#hits) {
      if (ts.every((t) => ahora - t >= ventanaMs)) this.#hits.delete(k);
    }
  }
}
