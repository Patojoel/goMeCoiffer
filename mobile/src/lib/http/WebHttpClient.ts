import { assertSafeApiPath, HttpError, parseApiEnvelope, type HttpClient } from '@gomecoiffer/client-core';
import { CSRF_HEADER, CsrfTokenSchema, ErrorCode } from '@gomecoiffer/contracts';
import type { z } from 'zod';
import { isSessionMutationPath } from './sessionPaths';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const WRITE_METHODS: readonly Method[] = ['POST', 'PUT', 'PATCH', 'DELETE'];
const CSRF_PATH = '/api/public/session/csrf';
const SIGN_OUT_PATH = '/api/public/auth/sign-out';

export type WebHttpClientOptions = {
  readonly baseUrl?: string;
  readonly fetchFn?: typeof fetch;
  readonly onCsrfDesync?: () => void;
};

export class WebHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly onCsrfDesync?: () => void;
  private csrfToken: string | null = null;
  private csrfInFlight: Promise<string> | null = null;
  private sessionEpoch = 0;
  private renewalQueue: Promise<unknown> = Promise.resolve();
  private readonly unauthorizedListeners = new Set<() => void>();
  private readonly sessionDesyncListeners = new Set<() => void>();

  constructor({ baseUrl = '', fetchFn, onCsrfDesync }: WebHttpClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
    this.onCsrfDesync = onCsrfDesync;
  }

  onUnauthorized(listener: () => void): () => void {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  onSessionDesync(listener: () => void): () => void {
    this.sessionDesyncListeners.add(listener);
    return () => {
      this.sessionDesyncListeners.delete(listener);
    };
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

  private runExclusiveRenewal<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.renewalQueue.then(operation, operation);
    this.renewalQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private notifySessionDesync(): void {
    this.onCsrfDesync?.();
    this.sessionDesyncListeners.forEach((listener) => listener());
  }

  private async request<T>(
    method: Method,
    path: string,
    body: unknown,
    schema?: z.ZodType<T>,
  ): Promise<T> {
    assertSafeApiPath(path);

    if (method === 'POST' && isSessionMutationPath(path)) {
      return this.runExclusiveRenewal(() => this.performRequest(method, path, body, schema));
    }
    return this.performRequest(method, path, body, schema);
  }

  private async performRequest<T>(
    method: Method,
    path: string,
    body: unknown,
    schema?: z.ZodType<T>,
  ): Promise<T> {
    try {
      return await this.send(method, path, body, schema);
    } catch (error) {
      if (
        error instanceof HttpError &&
        error.code === ErrorCode.CSRF_INVALID &&
        WRITE_METHODS.includes(method)
      ) {
        this.csrfToken = null;
        if (path.startsWith('/api/public/') && path !== SIGN_OUT_PATH) {
          return this.send(method, path, body, schema);
        }
        if (path !== SIGN_OUT_PATH) {
          this.notifySessionDesync();
        }
      }
      throw error;
    }
  }

  private async send<T>(method: Method, path: string, body: unknown, schema?: z.ZodType<T>): Promise<T> {
    const isSignOut = method === 'POST' && path === SIGN_OUT_PATH;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (WRITE_METHODS.includes(method)) headers[CSRF_HEADER] = await this.getCsrfToken();

      const startedEpoch = this.sessionEpoch;
      const response = await this.fetchRaw(method, path, headers, body);
      const rawBody: unknown = await response.json().catch(() => null);

      try {
        const data = parseApiEnvelope(response.status, rawBody, schema);
        if (
          !isSignOut &&
          path !== CSRF_PATH &&
          data &&
          typeof data === 'object' &&
          'csrfToken' in data &&
          typeof data.csrfToken === 'string' &&
          data.csrfToken.length > 0
        ) {
          this.csrfToken = data.csrfToken;
          this.sessionEpoch += 1;
        }
        return data;
      } catch (error) {
        if (!isSignOut && response.status === 401 && startedEpoch === this.sessionEpoch) {
          this.csrfToken = null;
          this.sessionEpoch += 1;
          this.unauthorizedListeners.forEach((listener) => listener());
        }
        throw error;
      }
    } finally {
      if (isSignOut) {
        this.csrfToken = null;
        this.sessionEpoch += 1;
      }
    }
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
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new HttpError(0, 'NETWORK_ERROR', 'Le serveur est injoignable.');
    }
  }

  private async getCsrfToken(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    if (!this.csrfInFlight) {
      const epochAtFetch = this.sessionEpoch;
      this.csrfInFlight = this.send('GET', CSRF_PATH, undefined, CsrfTokenSchema)
        .then(({ csrfToken }) => {
          if (this.sessionEpoch === epochAtFetch || !this.csrfToken) {
            this.csrfToken = csrfToken;
          }
          return this.csrfToken ?? csrfToken;
        })
        .finally(() => {
          this.csrfInFlight = null;
        });
    }
    return this.csrfInFlight;
  }
}
