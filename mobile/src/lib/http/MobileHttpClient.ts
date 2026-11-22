import {
  assertSafeApiPath,
  HttpError,
  parseApiEnvelope,
  type HttpClient,
  type TokenStorage,
} from '@gomecoiffer/client-core';
import type { z } from 'zod';
import { DEVICE_TOKEN_HEADER, MOBILE_CLIENT_CHANNEL, MOBILE_CLIENT_HEADER } from './headers';
import { isSessionMutationPath } from './sessionPaths';

export { DEVICE_TOKEN_HEADER, MOBILE_CLIENT_CHANNEL, MOBILE_CLIENT_HEADER };

const DEVICE_TOKEN_PATHS = new Set(['/api/public/auth/sign-in']);
const SIGN_OUT_PATH = '/api/public/auth/sign-out';
const DEVICE_TOKEN_ISSUING_PATHS = new Set([
  '/api/public/auth/sign-in',
  '/api/public/auth/password-reset',
]);

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type MobileHttpClientOptions = {
  readonly baseUrl: string;
  readonly storage: TokenStorage;
  readonly fetchFn?: typeof fetch;
};

export class MobileHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private readonly storage: TokenStorage;
  private readonly fetchFn: typeof fetch;
  private readonly unauthorizedListeners = new Set<() => void>();
  private renewalQueue: Promise<unknown> = Promise.resolve();
  private unauthorizedQueue: Promise<unknown> = Promise.resolve();

  constructor({ baseUrl, storage, fetchFn }: MobileHttpClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.storage = storage;
    this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
  }

  onUnauthorized(listener: () => void): () => void {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  /** Sérialise les actions qui régénèrent le jeton de session (RG-013-11). */
  runExclusiveRenewal<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.renewalQueue.then(operation, operation);
    this.renewalQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  get<T = unknown>(path: string, schema?: z.ZodType<T>): Promise<T> {
    return this.request('GET', path, undefined, schema);
  }

  post<T = unknown>(path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T> {
    return this.request('POST', path, body, schema);
  }

  put<T = unknown>(path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T> {
    return this.request('PUT', path, body, schema);
  }

  patch<T = unknown>(path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T> {
    return this.request('PATCH', path, body, schema);
  }

  delete<T = unknown>(path: string, schema?: z.ZodType<T>): Promise<T> {
    return this.request('DELETE', path, undefined, schema);
  }

  private async request<T>(method: Method, path: string, body: unknown, schema?: z.ZodType<T>): Promise<T> {
    assertSafeApiPath(path);

    if (method === 'POST' && isSessionMutationPath(path)) {
      return this.runExclusiveRenewal(() => this.executeRequest(method, path, body, schema));
    }
    return this.executeRequest(method, path, body, schema);
  }

  private async persistIssuedTokens(path: string, data: unknown): Promise<void> {
    if (typeof data !== 'object' || data === null) return;
    if ('sessionToken' in data && typeof data.sessionToken === 'string' && data.sessionToken.length > 0) {
      await this.storage.setSessionToken(data.sessionToken);
    }
    if (
      DEVICE_TOKEN_ISSUING_PATHS.has(path) &&
      'deviceToken' in data &&
      typeof data.deviceToken === 'string' &&
      data.deviceToken.length > 0
    ) {
      await this.storage.setDeviceToken(data.deviceToken);
    }
  }

  private async executeRequest<T>(
    method: Method,
    path: string,
    body: unknown,
    schema?: z.ZodType<T>,
  ): Promise<T> {
    const isSignOut = method === 'POST' && path === SIGN_OUT_PATH;
    const isSessionIssuer = method === 'POST' && isSessionMutationPath(path) && !isSignOut;
    const includeDeviceToken = DEVICE_TOKEN_PATHS.has(path);
    const [sentToken, deviceToken] = await Promise.all([
      this.storage.getSessionToken(),
      includeDeviceToken ? this.storage.getDeviceToken() : Promise.resolve(null),
    ]);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      [MOBILE_CLIENT_HEADER]: MOBILE_CLIENT_CHANNEL,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (sentToken) headers.Authorization = `Bearer ${sentToken}`;
    if (deviceToken) headers[DEVICE_TOKEN_HEADER] = deviceToken;

    try {
      const response = await this.fetchRaw(method, path, headers, body);
      const rawBody: unknown = await response.json().catch(() => null);

      try {
        const data = parseApiEnvelope(response.status, rawBody, schema);
        if (isSessionIssuer) {
          await this.persistIssuedTokens(path, data);
        }
        return data;
      } catch (error) {
        if (!isSignOut && response.status === 401 && sentToken !== null) {
          await this.handleUnauthorizedToken(sentToken);
        }
        throw error;
      }
    } finally {
      if (isSignOut) {
        await this.storage.clearSessionToken().catch(() => undefined);
      }
    }
  }

  private handleUnauthorizedToken(sentToken: string): Promise<void> {
    const clearIfCurrent = async () => {
      const currentToken = await this.storage.getSessionToken();
      if (sentToken === currentToken) {
        await this.storage.clearSessionToken();
        this.unauthorizedListeners.forEach((listener) => listener());
      }
    };
    const next = this.unauthorizedQueue.then(clearIfCurrent, clearIfCurrent);
    this.unauthorizedQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async fetchRaw(
    method: Method,
    path: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<Response> {
    try {
      return await this.fetchFn(`${this.baseUrl}${path}`, {
        method,
        headers,
        credentials: 'omit',
        redirect: 'error',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.');
    }
  }
}
