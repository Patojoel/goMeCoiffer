import { ErrorCode } from '@gomecoiffer/contracts';
import { HttpError } from '@gomecoiffer/client-core';
import { z } from 'zod';
import { InMemoryTokenStorage } from '../../storage/InMemoryTokenStorage';
import { DEVICE_TOKEN_HEADER, MOBILE_CLIENT_HEADER, MobileHttpClient } from '../MobileHttpClient';

const BASE_URL = 'https://api.gomecoiffer.test';

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response;
}

describe('Mobile authenticated HTTP transport (UC-013 T23/T24)', () => {
  it('sends app channel and bearer token without cookies/redirects, scoping device token to sign-in', async () => {
    const storage = new InMemoryTokenStorage({
      sessionToken: 'secret-session-token',
      deviceToken: 'trusted-device-token',
    });
    const captured: {
      url: string;
      headers: Record<string, string>;
      credentials?: RequestCredentials;
      redirect?: RequestRedirect;
    }[] = [];
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async (input, init) => {
        captured.push({
          url: String(input),
          headers: (init?.headers ?? {}) as Record<string, string>,
          credentials: init?.credentials,
          redirect: init?.redirect,
        });
        return jsonResponse(200, { status: 'OK', data: { salonName: 'Paul Barber' } });
      },
    });

    const data = await client.get('/api/salon/me', z.object({ salonName: z.string() }));
    await client.post('/api/public/auth/sign-in', { phone: '699001122', password: 'secret' });

    expect(data).toEqual({ salonName: 'Paul Barber' });
    expect(captured).toHaveLength(2);
    expect(captured[0]?.url).toBe(`${BASE_URL}/api/salon/me`);
    expect(captured[0]?.url).not.toContain('secret-session-token');
    expect(captured[0]?.url).not.toContain('trusted-device-token');
    expect(captured[0]?.credentials).toBe('omit');
    expect(captured[0]?.redirect).toBe('error');
    expect(captured[0]?.headers).toMatchObject({
      [MOBILE_CLIENT_HEADER]: 'mobile',
      Authorization: 'Bearer secret-session-token',
    });
    expect(captured[0]?.headers[DEVICE_TOKEN_HEADER]).toBeUndefined();
    expect(captured[1]?.headers[DEVICE_TOKEN_HEADER]).toBe('trusted-device-token');
  });

  it('omits Authorization and device headers when tokens are absent', async () => {
    const storage = new InMemoryTokenStorage();
    let sentHeaders: Record<string, string> = {};
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async (_input, init) => {
        sentHeaders = (init?.headers ?? {}) as Record<string, string>;
        return jsonResponse(200, { status: 'OK', data: { ok: true } });
      },
    });

    await client.post('/api/public/auth/sign-in', { phone: '699001122' });

    expect(sentHeaders[MOBILE_CLIENT_HEADER]).toBe('mobile');
    expect(sentHeaders.Authorization).toBeUndefined();
    expect(sentHeaders[DEVICE_TOKEN_HEADER]).toBeUndefined();
  });

  it('clears the current session token and notifies listeners on 401 while keeping device token', async () => {
    const storage = new InMemoryTokenStorage({
      sessionToken: 'expired-token',
      deviceToken: 'device-90d',
    });
    let unauthorizedCount = 0;
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async () =>
        jsonResponse(401, {
          status: 'ERROR',
          code: ErrorCode.UNAUTHENTICATED,
          message: 'Session absente ou expirée : reconnectez-vous.',
        }),
    });
    client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    const failure = await client.get('/api/salon/team').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ status: 401, code: ErrorCode.UNAUTHENTICATED });
    expect(unauthorizedCount).toBe(1);
    expect(await storage.getSessionToken()).toBeNull();
    expect(await storage.getDeviceToken()).toBe('device-90d');
  });

  it('ignores 401 from a replaced token without clearing the newer session token (RG-013-11)', async () => {
    const storage = new InMemoryTokenStorage({
      sessionToken: 'token-old',
      deviceToken: 'device-90d',
    });
    let unauthorizedCount = 0;
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async () => {
        await storage.setSessionToken('token-new');
        return jsonResponse(401, {
          status: 'ERROR',
          code: ErrorCode.UNAUTHENTICATED,
          message: 'Session absente ou expirée : reconnectez-vous.',
        });
      },
    });
    client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    const failure = await client.get('/api/salon/planning').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ status: 401, code: ErrorCode.UNAUTHENTICATED });
    expect(unauthorizedCount).toBe(0);
    expect(await storage.getSessionToken()).toBe('token-new');
  });

  it('keeps the session token and does not sign out on 403 forbidden (RG-013-07)', async () => {
    const storage = new InMemoryTokenStorage({ sessionToken: 'client-token' });
    let unauthorizedCount = 0;
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async () =>
        jsonResponse(403, {
          status: 'ERROR',
          code: 'STAFF_SIGN_IN_REQUIRED',
          message: 'Cet espace est réservé aux salons.',
        }),
    });
    client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    const failure = await client.get('/api/salon/planning').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ status: 403, code: 'STAFF_SIGN_IN_REQUIRED' });
    expect(unauthorizedCount).toBe(0);
    expect(await storage.getSessionToken()).toBe('client-token');
  });

  it('keeps both tokens on network outage and throws NETWORK_ERROR (RG-013-17)', async () => {
    const storage = new InMemoryTokenStorage({
      sessionToken: 'active-token',
      deviceToken: 'device-90d',
    });
    let unauthorizedCount = 0;
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async () => {
        throw new TypeError('Network request failed');
      },
    });
    client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    const failure = await client.get('/api/public/health').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(HttpError);
    expect(failure).toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    expect(unauthorizedCount).toBe(0);
    expect(await storage.getSessionToken()).toBe('active-token');
    expect(await storage.getDeviceToken()).toBe('device-90d');
  });

  it('preserves device token on clearSessionToken and stops notifying unsubscribed listeners', async () => {
    const storage = new InMemoryTokenStorage({
      sessionToken: 'active-token',
      deviceToken: 'device-90d',
    });
    await storage.clearSessionToken();
    expect(await storage.getSessionToken()).toBeNull();
    expect(await storage.getDeviceToken()).toBe('device-90d');

    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async () =>
        jsonResponse(401, {
          status: 'ERROR',
          code: ErrorCode.UNAUTHENTICATED,
          message: 'Session absente ou expirée.',
        }),
    });
    let unauthorizedCount = 0;
    const unsubscribe = client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });
    unsubscribe();

    await client.get('/api/salon/me').catch(() => undefined);

    expect(unauthorizedCount).toBe(0);
  });

  it('ignores 401 when the request carried no session token so concurrent sign-in is not cleared', async () => {
    const storage = new InMemoryTokenStorage();
    let unauthorizedCount = 0;
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async () =>
        jsonResponse(401, {
          status: 'ERROR',
          code: ErrorCode.UNAUTHENTICATED,
          message: 'Session absente.',
        }),
    });
    client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    await expect(client.get('/api/salon/me')).rejects.toMatchObject({ status: 401 });
    expect(unauthorizedCount).toBe(0);
  });

  it('rejects protocol-relative or unprefixed paths before issuing any network call', async () => {
    let called = false;
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage: new InMemoryTokenStorage({ sessionToken: 'secret' }),
      fetchFn: async () => {
        called = true;
        return jsonResponse(200, { status: 'OK', data: null });
      },
    });

    await expect(client.get('//evil.example/steal')).rejects.toBeInstanceOf(HttpError);
    await expect(client.get('.evil.example/steal')).rejects.toBeInstanceOf(HttpError);
    expect(called).toBe(false);
  });

  it('serializes concurrent session renewals so only one runs at a time (RG-013-11)', async () => {
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage: new InMemoryTokenStorage({ sessionToken: 'tok-1' }),
    });
    const order: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = client.runExclusiveRenewal(async () => {
      order.push('first:start');
      await firstGate;
      order.push('first:end');
      return 'one';
    });
    const second = client.runExclusiveRenewal(async () => {
      order.push('second:start');
      order.push('second:end');
      return 'two';
    });

    await Promise.resolve();
    expect(order).toEqual(['first:start']);

    releaseFirst();
    await expect(Promise.all([first, second])).resolves.toEqual(['one', 'two']);
    expect(order).toEqual(['first:start', 'first:end', 'second:start', 'second:end']);
  });

  for (const [label, handler, expectedError] of [
    [
      'network outage',
      async () => {
        throw new TypeError('Network request failed');
      },
      { status: 0, code: 'NETWORK_ERROR' },
    ],
    [
      '401 UNAUTHENTICATED',
      async () =>
        jsonResponse(401, {
          status: 'ERROR',
          code: ErrorCode.UNAUTHENTICATED,
          message: 'Session expirée.',
        }),
      { status: 401, code: ErrorCode.UNAUTHENTICATED },
    ],
    [
      '403 FORBIDDEN',
      async () =>
        jsonResponse(403, {
          status: 'ERROR',
          code: ErrorCode.FORBIDDEN,
          message: 'Refusé.',
        }),
      { status: 403, code: ErrorCode.FORBIDDEN },
    ],
  ] as const) {
    it(`always clears sessionToken on sign-out even on ${label} while preserving deviceToken (RG-013-12)`, async () => {
      const storage = new InMemoryTokenStorage({
        sessionToken: 'active-token',
        deviceToken: 'device-90d',
      });
      let unauthorizedCount = 0;
      const client = new MobileHttpClient({
        baseUrl: BASE_URL,
        storage,
        fetchFn: handler,
      });
      client.onUnauthorized(() => {
        unauthorizedCount += 1;
      });

      const failure = await client.post('/api/public/auth/sign-out').catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(HttpError);
      expect(failure).toMatchObject(expectedError);
      expect(unauthorizedCount).toBe(0);
      expect(await storage.getSessionToken()).toBeNull();
      expect(await storage.getDeviceToken()).toBe('device-90d');
    });
  }

  it('clears sessionToken on successful sign-out while preserving deviceToken (RG-013-12)', async () => {
    const storage = new InMemoryTokenStorage({
      sessionToken: 'active-token',
      deviceToken: 'device-90d',
    });
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async () => jsonResponse(200, { status: 'OK', data: { signedOut: true } }),
    });

    const res = await client.post('/api/public/auth/sign-out');

    expect(res).toEqual({ signedOut: true });
    expect(await storage.getSessionToken()).toBeNull();
    expect(await storage.getDeviceToken()).toBe('device-90d');
  });

  for (const [path, firstBody, secondBody] of [
    ['/api/salon/session/active-salon', { salonId: 's1' }, { salonId: 's2' }],
    ['/api/salon/organizations', { name: 'Org 1' }, { name: 'Org 2' }],
    ['/api/salon/salons', { name: 'Salon 1' }, { name: 'Salon 2' }],
  ] as const) {
    it(`serializes concurrent POST requests on session renewal path ${path} (RG-013-11)`, async () => {
      const storage = new InMemoryTokenStorage({ sessionToken: 'tok-initial' });
      const events: string[] = [];
      const sentTokens: string[] = [];
      let releaseFirst!: () => void;
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });

      const client = new MobileHttpClient({
        baseUrl: BASE_URL,
        storage,
        fetchFn: async (_input, init) => {
          const headers = (init?.headers ?? {}) as Record<string, string>;
          sentTokens.push(headers.Authorization ?? '');
          const callIndex = sentTokens.length;
          events.push(`fetch-${callIndex}:start`);
          if (callIndex === 1) {
            await firstGate;
            await storage.setSessionToken('tok-renewed');
          }
          events.push(`fetch-${callIndex}:end`);
          return jsonResponse(200, { status: 'OK', data: { callIndex } });
        },
      });

      const first = client.post(path, firstBody);
      const second = client.post(path, secondBody);

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(events).toEqual(['fetch-1:start']);

      releaseFirst();
      await expect(Promise.all([first, second])).resolves.toEqual([{ callIndex: 1 }, { callIndex: 2 }]);
      expect(events).toEqual(['fetch-1:start', 'fetch-1:end', 'fetch-2:start', 'fetch-2:end']);
      expect(sentTokens).toEqual(['Bearer tok-initial', 'Bearer tok-renewed']);
    });
  }

  for (const path of [
    '/api/public/auth/sign-in',
    '/api/public/auth/password-reset',
    '/api/public/sign-up',
    '/api/public/client/session',
    '/api/public/invitations/0195f000-0000-7000-8000-000000000d01/acceptance',
  ] as const) {
    it(`serializes concurrent POST requests on session mutation path ${path} and persists rotated sessionToken`, async () => {
      const storage = new InMemoryTokenStorage({ sessionToken: 'tok-initial' });
      const events: string[] = [];
      const sentTokens: string[] = [];
      let releaseFirst!: () => void;
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });

      const client = new MobileHttpClient({
        baseUrl: BASE_URL,
        storage,
        fetchFn: async (_input, init) => {
          const headers = (init?.headers ?? {}) as Record<string, string>;
          sentTokens.push(headers.Authorization ?? '');
          const callIndex = sentTokens.length;
          events.push(`fetch-${callIndex}:start`);
          if (callIndex === 1) {
            await firstGate;
          }
          events.push(`fetch-${callIndex}:end`);
          return jsonResponse(200, {
            status: 'OK',
            data: { sessionToken: `tok-issued-${callIndex}` },
          });
        },
      });

      const first = client.post(path, { step: 1 });
      const second = client.post(path, { step: 2 });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(events).toEqual(['fetch-1:start']);

      releaseFirst();
      await Promise.all([first, second]);

      expect(events).toEqual(['fetch-1:start', 'fetch-1:end', 'fetch-2:start', 'fetch-2:end']);
      expect(sentTokens).toEqual(['Bearer tok-initial', 'Bearer tok-issued-1']);
      expect(await storage.getSessionToken()).toBe('tok-issued-2');
    });
  }

  it('persists deviceToken from sign-in and password-reset responses only, and ignores sessionToken on non-session paths', async () => {
    const storage = new InMemoryTokenStorage();
    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async (input) => {
        const url = String(input);
        if (url.endsWith('/api/public/auth/sign-in')) {
          return jsonResponse(200, {
            status: 'OK',
            data: { sessionToken: 'sess-1', deviceToken: 'dev-from-signin' },
          });
        }
        if (url.endsWith('/api/public/auth/password-reset')) {
          return jsonResponse(200, {
            status: 'OK',
            data: { sessionToken: 'sess-2', deviceToken: 'dev-from-reset' },
          });
        }
        if (url.endsWith('/api/public/client/session')) {
          return jsonResponse(200, {
            status: 'OK',
            data: { sessionToken: 'sess-client', deviceToken: 'should-not-overwrite-device' },
          });
        }
        return jsonResponse(200, {
          status: 'OK',
          data: { sessionToken: 'forged-from-non-session', deviceToken: 'forged-device' },
        });
      },
    });

    await client.post('/api/public/auth/sign-in', {});
    expect(await storage.getSessionToken()).toBe('sess-1');
    expect(await storage.getDeviceToken()).toBe('dev-from-signin');

    await client.post('/api/public/auth/password-reset', {});
    expect(await storage.getSessionToken()).toBe('sess-2');
    expect(await storage.getDeviceToken()).toBe('dev-from-reset');

    await client.post('/api/public/client/session', {});
    expect(await storage.getSessionToken()).toBe('sess-client');
    expect(await storage.getDeviceToken()).toBe('dev-from-reset');

    await client.post('/api/salon/bookings', {});
    expect(await storage.getSessionToken()).toBe('sess-client');
    expect(await storage.getDeviceToken()).toBe('dev-from-reset');
  });

  it('notifies unauthorizedListeners only once when parallel requests with the same token fail with 401', async () => {
    const storage = new InMemoryTokenStorage({ sessionToken: 'tok-expired' });
    let unauthorizedCount = 0;

    const client = new MobileHttpClient({
      baseUrl: BASE_URL,
      storage,
      fetchFn: async () =>
        jsonResponse(401, {
          status: 'ERROR',
          code: ErrorCode.UNAUTHENTICATED,
          message: 'Session expirée.',
        }),
    });
    client.onUnauthorized(() => {
      unauthorizedCount += 1;
    });

    await Promise.allSettled([client.get('/api/salon/team'), client.get('/api/salon/roles')]);

    expect(unauthorizedCount).toBe(1);
    expect(await storage.getSessionToken()).toBeNull();
  });
});
