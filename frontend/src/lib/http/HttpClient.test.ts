import { CSRF_HEADER, ErrorCode } from '@gomecoiffer/contracts';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { HttpClient, HttpError } from './HttpClient';

const BASE = 'http://api.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const ok = <T>(data: T) => HttpResponse.json({ status: 'OK', data });
const error = (status: number, code: string, message = 'refus', errors?: unknown) =>
  HttpResponse.json({ status: 'ERROR', code, message, errors }, { status });

/** Sert un jeton CSRF numéroté (t1, t2…) et compte les appels. */
function serveCsrf() {
  let issued = 0;
  server.use(http.get(`${BASE}/api/public/session/csrf`, () => ok({ csrfToken: `t${++issued}` })));
  return () => issued;
}

const newClient = () => new HttpClient({ baseUrl: BASE });

describe('HttpClient', () => {
  it('déballe la donnée d une réponse OK et envoie les cookies', async () => {
    let credentials: RequestCredentials | undefined;
    server.use(http.get(`${BASE}/api/public/things`, () => ok({ n: 1 })));
    const client = new HttpClient({
      baseUrl: BASE,
      fetchFn: (input, init) => {
        credentials = init?.credentials;
        return fetch(input, init);
      },
    });

    const data = await client.get('/api/public/things', z.object({ n: z.number() }));

    expect(data).toEqual({ n: 1 });
    expect(credentials).toBe('include');
  });

  it('lève une HttpError typée sur une réponse ERROR', async () => {
    server.use(
      http.get(`${BASE}/api/salon/x`, () =>
        error(422, 'RULE', 'Règle refusée', [{ path: 'name', message: 'requis' }]),
      ),
    );

    const failure = await newClient()
      .get('/api/salon/x')
      .catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({
      status: 422,
      code: 'RULE',
      message: 'Règle refusée',
      errors: [{ path: 'name', message: 'requis' }],
    });
  });

  it('lève une HttpError réseau quand le serveur est injoignable', async () => {
    server.use(http.get(`${BASE}/api/public/down`, () => HttpResponse.error()));

    const failure = await newClient()
      .get('/api/public/down')
      .catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('n envoie pas de jeton CSRF sur une lecture', async () => {
    const issued = serveCsrf();
    let header: string | null = 'unset';
    server.use(
      http.get(`${BASE}/api/public/a`, ({ request }) => {
        header = request.headers.get(CSRF_HEADER);
        return ok(null);
      }),
    );

    await newClient().get('/api/public/a');

    expect(header).toBeNull();
    expect(issued()).toBe(0);
  });

  it('envoie le jeton CSRF sur une écriture et le met en cache', async () => {
    const issued = serveCsrf();
    const seen: (string | null)[] = [];
    server.use(
      http.post(`${BASE}/api/salon/a`, ({ request }) => {
        seen.push(request.headers.get(CSRF_HEADER));
        return ok(null);
      }),
    );
    const client = newClient();

    await client.post('/api/salon/a', { x: 1 });
    await client.post('/api/salon/a', { x: 2 });

    expect(seen).toEqual(['t1', 't1']);
    expect(issued()).toBe(1);
  });

  it('renouvelle le jeton et retente une fois après un CSRF_INVALID', async () => {
    serveCsrf();
    const seen: (string | null)[] = [];
    server.use(
      http.delete(`${BASE}/api/salon/a`, ({ request }) => {
        const token = request.headers.get(CSRF_HEADER);
        seen.push(token);
        return token === 't1' ? error(403, ErrorCode.CSRF_INVALID) : ok({ done: true });
      }),
    );

    const data = await newClient().delete('/api/salon/a');

    expect(data).toEqual({ done: true });
    expect(seen).toEqual(['t1', 't2']);
  });

  it('ne retente qu une fois quand le CSRF reste invalide', async () => {
    serveCsrf();
    let calls = 0;
    server.use(
      http.put(`${BASE}/api/salon/a`, () => {
        calls++;
        return error(403, ErrorCode.CSRF_INVALID);
      }),
    );

    await expect(newClient().put('/api/salon/a', {})).rejects.toMatchObject({ code: 'CSRF_INVALID' });
    expect(calls).toBe(2);
  });

  it('notifie l abonné sur un 401', async () => {
    server.use(http.get(`${BASE}/api/salon/me`, () => error(401, ErrorCode.UNAUTHENTICATED)));
    const client = newClient();
    const onUnauthorized = vi.fn();
    client.onUnauthorized(onUnauthorized);

    await expect(client.get('/api/salon/me')).rejects.toMatchObject({ status: 401 });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('ne notifie pas l abonné sur un 403 (droit insuffisant)', async () => {
    server.use(http.get(`${BASE}/api/salon/staff`, () => error(403, ErrorCode.FORBIDDEN)));
    const client = newClient();
    const onUnauthorized = vi.fn();
    client.onUnauthorized(onUnauthorized);

    await expect(client.get('/api/salon/staff')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('ne notifie plus un abonné désabonné', async () => {
    server.use(http.get(`${BASE}/api/salon/me`, () => error(401, ErrorCode.UNAUTHENTICATED)));
    const client = newClient();
    const onUnauthorized = vi.fn();
    client.onUnauthorized(onUnauthorized)();

    await client.get('/api/salon/me').catch(() => undefined);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
