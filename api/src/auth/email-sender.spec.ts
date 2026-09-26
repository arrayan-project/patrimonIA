import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrevoEmailSender, ConsoleEmailSender, crearEmailSender } from './email-sender.js';

describe('crearEmailSender', () => {
  it('sin BREVO_API_KEY usa la consola', () => {
    expect(crearEmailSender({})).toBeInstanceOf(ConsoleEmailSender);
  });

  it('con BREVO_API_KEY usa Brevo y exige EMAIL_REMITENTE', () => {
    expect(crearEmailSender({ BREVO_API_KEY: 'k', EMAIL_REMITENTE: 'yo@x.cl' })).toBeInstanceOf(
      BrevoEmailSender,
    );
    expect(() => crearEmailSender({ BREVO_API_KEY: 'k' })).toThrow(/EMAIL_REMITENTE/);
  });
});

describe('BrevoEmailSender', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envía el email a la API de Brevo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    await new BrevoEmailSender('clave', { email: 'yo@x.cl', name: 'PatrimonIA' }).enviar(
      'a@x.cl',
      'Asunto',
      'Cuerpo',
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('clave');
    expect(JSON.parse(init.body)).toEqual({
      sender: { email: 'yo@x.cl', name: 'PatrimonIA' },
      to: [{ email: 'a@x.cl' }],
      subject: 'Asunto',
      textContent: 'Cuerpo',
    });
  });

  it('falla si Brevo responde error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 401 })));
    await expect(
      new BrevoEmailSender('mala', { email: 'yo@x.cl', name: 'P' }).enviar('a@x.cl', 's', 'c'),
    ).rejects.toThrow(/401/);
  });
});
