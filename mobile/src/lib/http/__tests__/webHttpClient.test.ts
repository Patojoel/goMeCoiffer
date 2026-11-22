import { CSRF_HEADER, ErrorCode } from '@gomecoiffer/contracts';
import { HttpError } from '@gomecoiffer/client-core';
import { z } from 'zod';
import { WebHttpClient } from '../WebHttpClient';

const BASE_URL = 'https://api.gomecoiffer.test';

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

describe('Web cookie and CSRF HTTP transport (D-004)', () => {
  it('unwraps OK data with Zod schema and sends credentials include', async () => {
    let seenCredentials: RequestCredentials | undefined;
    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (_input, init) => {
        seenCredentials = init?.credentials;
        return jsonResponse(200, { status: 'OK', data: { count: 3 } });
      },
    });

    const data = await client.get('/api/public/salons', z.object({ count: z.number() }));

    expect(data).toEqual({ count: 3 });
    expect(seenCredentials).toBe('include');
  });

  it('does not fetch or send CSRF token on GET reads', async () => {
    const requestedUrls: string[] = [];
    let csrfHeader: string | undefined;
    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (input, init) => {
        requestedUrls.push(String(input));
        csrfHeader = ((init?.headers ?? {}) as Record<string, string>)[CSRF_HEADER];
        return jsonResponse(200, { status: 'OK', data: null });
      },
    });

    await client.get('/api/public/health');

    expect(requestedUrls).toEqual([`${BASE_URL}/api/public/health`]);
    expect(csrfHeader).toBeUndefined();
  });

  it('fetches and caches CSRF token across write requests', async () => {
    let csrfFetchCount = 0;
    const seenTokens: (string | undefined)[] = [];
    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (input, init) => {
        const url = String(input);
        if (url === `${BASE_URL}/api/public/session/csrf`) {
          csrfFetchCount += 1;
          return jsonResponse(200, { status: 'OK', data: { csrfToken: `csrf-${csrfFetchCount}` } });
        }
        seenTokens.push(((init?.headers ?? {}) as Record<string, string>)[CSRF_HEADER]);
        return jsonResponse(200, { status: 'OK', data: { ok: true } });
      },
    });

    await client.post('/api/salon/bookings', { id: 'b1' });
    await client.patch('/api/salon/bookings/b1', { note: 'ok' });

    expect(csrfFetchCount).toBe(1);
    expect(seenTokens).toEqual(['csrf-1', 'csrf-1']);
  });

  it('refreshes CSRF token and retries once on CSRF_INVALID for public non-sign-out routes (D-039)', async () => {
    let csrfFetchCount = 0;
    const seenTokens: (string | undefined)[] = [];
    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (input, init) => {
        const url = String(input);
        if (url === `${BASE_URL}/api/public/session/csrf`) {
          csrfFetchCount += 1;
          return jsonResponse(200, { status: 'OK', data: { csrfToken: `csrf-${csrfFetchCount}` } });
        }
        const token = ((init?.headers ?? {}) as Record<string, string>)[CSRF_HEADER];
        seenTokens.push(token);
        if (token === 'csrf-1') {
          return jsonResponse(403, {
            status: 'ERROR',
            code: ErrorCode.CSRF_INVALID,
            message: 'Jeton de sécurité expiré.',
          });
        }
        return jsonResponse(200, { status: 'OK', data: { done: true } });
      },
    });

    const data = await client.post('/api/public/bookings', { slot: '10:00' }, z.object({ done: z.boolean() }));

    expect(data).toEqual({ done: true });
    expect(seenTokens).toEqual(['csrf-1', 'csrf-2']);
  });

  it('stops retrying after one CSRF refresh when CSRF_INVALID persists on public routes', async () => {
    let csrfFetchCount = 0;
    let writeAttempts = 0;
    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (input) => {
        if (String(input) === `${BASE_URL}/api/public/session/csrf`) {
          csrfFetchCount += 1;
          return jsonResponse(200, { status: 'OK', data: { csrfToken: `csrf-${csrfFetchCount}` } });
        }
        writeAttempts += 1;
        return jsonResponse(403, {
          status: 'ERROR',
          code: ErrorCode.CSRF_INVALID,
          message: 'Jeton invalide.',
        });
      },
    });

    const failure = await client.put('/api/public/bookings/b1', {}).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ status: 403, code: ErrorCode.CSRF_INVALID });
    expect(writeAttempts).toBe(2);
  });

  it('does not retry CSRF_INVALID on private routes, clears csrfToken and notifies desync callbacks (D-039)', async () => {
    let csrfFetches = 0;
    let privateWrites = 0;
    let optionDesyncCalls = 0;
    let listenerDesyncCalls = 0;

    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      onCsrfDesync: () => {
        optionDesyncCalls += 1;
      },
      fetchFn: async (input) => {
        const url = String(input);
        if (url === `${BASE_URL}/api/public/session/csrf`) {
          csrfFetches += 1;
          return jsonResponse(200, { status: 'OK', data: { csrfToken: `csrf-${csrfFetches}` } });
        }
        if (url.endsWith('/api/public/sign-up/code')) {
          return jsonResponse(200, { status: 'OK', data: { ok: true } });
        }
        privateWrites += 1;
        return jsonResponse(403, {
          status: 'ERROR',
          code: ErrorCode.CSRF_INVALID,
          message: 'Session désynchronisée.',
        });
      },
    });
    client.onSessionDesync(() => {
      listenerDesyncCalls += 1;
    });

    const failure = await client.delete('/api/salon/bookings/b1').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ status: 403, code: ErrorCode.CSRF_INVALID });
    expect(privateWrites).toBe(1);
    expect(optionDesyncCalls).toBe(1);
    expect(listenerDesyncCalls).toBe(1);

    // Cleared csrfToken forces a fresh CSRF fetch on the next write instead of reusing the stale token.
    await client.post('/api/public/sign-up/code', { phone: '677000000' });
    expect(csrfFetches).toBe(2);
  });

  it('notifies listeners on 401 and ignores 403 forbidden without disconnecting', async () => {
    let statusToReturn = 401;
    let codeToReturn: string = ErrorCode.UNAUTHENTICATED;
    let unauthorizedCount = 0;
    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async () =>
        jsonResponse(statusToReturn, {
          status: 'ERROR',
          code: codeToReturn,
          message: 'Refus',
        }),
    });
    const unsubscribe = client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    await expect(client.get('/api/salon/me')).rejects.toMatchObject({ status: 401 });
    expect(unauthorizedCount).toBe(1);

    statusToReturn = 403;
    codeToReturn = ErrorCode.FORBIDDEN;
    await expect(client.get('/api/salon/staff')).rejects.toMatchObject({
      status: 403,
      code: ErrorCode.FORBIDDEN,
    });
    expect(unauthorizedCount).toBe(1);

    unsubscribe();
    statusToReturn = 401;
    codeToReturn = ErrorCode.UNAUTHENTICATED;
    await client.get('/api/salon/me').catch(() => undefined);
    expect(unauthorizedCount).toBe(1);
  });

  it('throws NETWORK_ERROR when fetch rejects', async () => {
    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    const failure = await client.get('/api/public/health').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('deduplicates concurrent CSRF token fetches and rejects unsafe paths', async () => {
    let csrfCalls = 0;
    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (input) => {
        if (String(input) === `${BASE_URL}/api/public/session/csrf`) {
          csrfCalls += 1;
          return jsonResponse(200, { status: 'OK', data: { csrfToken: 'csrf-shared' } });
        }
        return jsonResponse(200, { status: 'OK', data: { ok: true } });
      },
    });

    await Promise.all([client.post('/api/salon/a', { step: 1 }), client.post('/api/salon/b', { step: 2 })]);

    expect(csrfCalls).toBe(1);
    await expect(client.get('//evil.example/leak')).rejects.toBeInstanceOf(HttpError);
  });

  it('synchronizes rotated CSRF token from session-regenerating responses and clears it on sign-out', async () => {
    const sentCsrfHeaders: (string | undefined)[] = [];
    let csrfFetches = 0;

    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (input, init) => {
        const url = String(input);
        if (url === `${BASE_URL}/api/public/session/csrf`) {
          csrfFetches += 1;
          return jsonResponse(200, { status: 'OK', data: { csrfToken: `boot-${csrfFetches}` } });
        }
        sentCsrfHeaders.push(((init?.headers ?? {}) as Record<string, string>)[CSRF_HEADER]);
        if (url.endsWith('/api/public/auth/sign-in')) {
          return jsonResponse(200, { status: 'OK', data: { csrfToken: 'rotated-after-signin' } });
        }
        if (url.endsWith('/api/public/auth/sign-out')) {
          return jsonResponse(200, { status: 'OK', data: { signedOut: true } });
        }
        return jsonResponse(200, { status: 'OK', data: { ok: true } });
      },
    });

    await client.post('/api/public/auth/sign-in', { phone: '677123456', password: 'secret' });
    await client.post('/api/salon/organizations', { name: 'Go Beauty' });
    await client.post('/api/public/auth/sign-out');
    await client.post('/api/salon/ping', {});

    expect(sentCsrfHeaders).toEqual(['boot-1', 'rotated-after-signin', 'rotated-after-signin', 'boot-2']);
  });

  it('ignores stale pre-rotation 401 without clearing the rotated CSRF token or disconnecting', async () => {
    let releaseStaleRead!: () => void;
    const staleReadGate = new Promise<void>((resolve) => {
      releaseStaleRead = resolve;
    });
    const sentCsrfHeaders: (string | undefined)[] = [];
    let unauthorizedCount = 0;

    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (input, init) => {
        const url = String(input);
        if (url === `${BASE_URL}/api/public/session/csrf`) {
          return jsonResponse(200, { status: 'OK', data: { csrfToken: 'csrf-initial' } });
        }
        if (url.endsWith('/api/salon/me')) {
          await staleReadGate;
          return jsonResponse(401, {
            status: 'ERROR',
            code: ErrorCode.UNAUTHENTICATED,
            message: 'Session expirée.',
          });
        }
        sentCsrfHeaders.push(((init?.headers ?? {}) as Record<string, string>)[CSRF_HEADER]);
        if (url.endsWith('/api/public/auth/sign-in')) {
          return jsonResponse(200, { status: 'OK', data: { csrfToken: 'csrf-rotated' } });
        }
        return jsonResponse(200, { status: 'OK', data: { ok: true } });
      },
    });
    client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    const staleRead = client.get('/api/salon/me');
    await Promise.resolve();
    await client.post('/api/public/auth/sign-in', { phone: '677123456', password: 'secret' });

    releaseStaleRead();
    await expect(staleRead).rejects.toMatchObject({ status: 401, code: ErrorCode.UNAUTHENTICATED });
    expect(unauthorizedCount).toBe(0);

    await client.post('/api/salon/bookings', { id: 'b1' });
    expect(sentCsrfHeaders).toEqual(['csrf-initial', 'csrf-rotated']);
  });

  it('serializes concurrent session-mutating POST requests so the second uses the rotated CSRF token', async () => {
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const events: string[] = [];
    const sentTokens: (string | undefined)[] = [];

    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (input, init) => {
        const url = String(input);
        if (url === `${BASE_URL}/api/public/session/csrf`) {
          return jsonResponse(200, { status: 'OK', data: { csrfToken: 'csrf-1' } });
        }
        sentTokens.push(((init?.headers ?? {}) as Record<string, string>)[CSRF_HEADER]);
        if (url.endsWith('/api/salon/session/active-salon')) {
          events.push('switch:start');
          await firstGate;
          events.push('switch:end');
          return jsonResponse(200, { status: 'OK', data: { csrfToken: 'csrf-2' } });
        }
        events.push('org:start');
        events.push('org:end');
        return jsonResponse(201, { status: 'OK', data: { csrfToken: 'csrf-3' } });
      },
    });

    const first = client.post('/api/salon/session/active-salon', { salonId: 's1' });
    const second = client.post('/api/salon/organizations', { name: 'Go Beauty' });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(['switch:start']);

    releaseFirst();
    await Promise.all([first, second]);

    expect(events).toEqual(['switch:start', 'switch:end', 'org:start', 'org:end']);
    expect(sentTokens).toEqual(['csrf-1', 'csrf-2']);
  });

  it('clears csrfToken and bumps epoch on sign-out even on 401 without notifying unauthorizedListeners', async () => {
    let csrfFetches = 0;
    let unauthorizedCount = 0;

    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (input) => {
        const url = String(input);
        if (url === `${BASE_URL}/api/public/session/csrf`) {
          csrfFetches += 1;
          return jsonResponse(200, { status: 'OK', data: { csrfToken: `csrf-${csrfFetches}` } });
        }
        if (url.endsWith('/api/public/auth/sign-out')) {
          return jsonResponse(401, {
            status: 'ERROR',
            code: ErrorCode.UNAUTHENTICATED,
            message: 'Session expirée.',
          });
        }
        return jsonResponse(200, { status: 'OK', data: { ok: true } });
      },
    });
    client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    await expect(client.post('/api/public/auth/sign-out')).rejects.toMatchObject({ status: 401 });
    expect(unauthorizedCount).toBe(0);

    await client.post('/api/public/sign-up/code', { phone: '677000000' });
    expect(csrfFetches).toBe(2);
  });

  it('bumps sessionEpoch in finally on sign-out even if initial CSRF fetch fails so stale 401 is ignored', async () => {
    let releaseStaleRead!: () => void;
    const staleReadGate = new Promise<void>((resolve) => {
      releaseStaleRead = resolve;
    });
    let unauthorizedCount = 0;

    const client = new WebHttpClient({
      baseUrl: BASE_URL,
      fetchFn: async (input) => {
        const url = String(input);
        if (url === `${BASE_URL}/api/public/session/csrf`) {
          throw new TypeError('Network failure during CSRF fetch');
        }
        await staleReadGate;
        return jsonResponse(401, {
          status: 'ERROR',
          code: ErrorCode.UNAUTHENTICATED,
          message: 'Session expirée.',
        });
      },
    });
    client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    const staleRead = client.get('/api/salon/me');
    await Promise.resolve();

    await expect(client.post('/api/public/auth/sign-out')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });

    releaseStaleRead();
    await expect(staleRead).rejects.toMatchObject({ status: 401 });
    expect(unauthorizedCount).toBe(0);
  });
});
