import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExpoPushSender } from './push-sender.js';

const T1 = 'ExponentPushToken[uno]';
const T2 = 'ExponentPushToken[dos]';

function sender(): ExpoPushSender {
  const s = new ExpoPushSender();
  s.reintentosMs = [0, 0];
  return s;
}

const ok = (data: unknown[]) => new Response(JSON.stringify({ data }), { status: 200 });

describe('ExpoPushSender', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('no llama a Expo si no hay tokens de Expo', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await sender().enviar(['otro'], 't', 'c')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reintenta ante 5xx y error de red hasta lograrlo', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(ok([{ status: 'ok' }]));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sender().enviar([T1], 't', 'c')).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('se rinde tras agotar los reintentos sin propagar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sender().enviar([T1], 't', 'c')).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('no reintenta un 4xx distinto de 429', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    await sender().enviar([T1], 't', 'c');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('devuelve los tokens con ticket DeviceNotRegistered', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        ok([{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }]),
      ),
    );
    expect(await sender().enviar([T1, T2], 't', 'c')).toEqual([T2]);
  });
});
