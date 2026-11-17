import {
  apiResponseSchema,
  CSRF_HEADER,
  CsrfTokenSchema,
  ErrorCode,
  type FieldError,
} from '@gomecoiffer/contracts';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors: readonly FieldError[] = [],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export type HttpClientOptions = {
  /** Vide = même origine (le proxy Vite sert `/api` en local). */
  baseUrl?: string;
  fetchFn?: typeof fetch;
};

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
const WRITE_METHODS: readonly Method[] = ['POST', 'PUT', 'PATCH', 'DELETE'];
const CSRF_PATH = '/api/public/session/csrf';

const envelope = apiResponseSchema(z.unknown());

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private csrfToken: string | null = null;
  private readonly unauthorizedListeners = new Set<() => void>();

  constructor({ baseUrl = '', fetchFn }: HttpClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
  }

  /** Abonne un écouteur appelé sur tout 401 (session expirée) ; renvoie le désabonnement. */
  onUnauthorized(listener: () => void): () => void {
    this.unauthorizedListeners.add(listener);
    return () => this.unauthorizedListeners.delete(listener);
  }

  get<T = unknown>(path: string, schema?: z.ZodType<T>) {
    return this.request('GET', path, undefined, schema);
  }
  post<T = unknown>(path: string, body?: unknown, schema?: z.ZodType<T>) {
    return this.request('POST', path, body, schema);
  }
  put<T = unknown>(path: string, body?: unknown, schema?: z.ZodType<T>) {
    return this.request('PUT', path, body, schema);
  }
  patch<T = unknown>(path: string, body?: unknown, schema?: z.ZodType<T>) {
    return this.request('PATCH', path, body, schema);
  }
  delete<T = unknown>(path: string, schema?: z.ZodType<T>) {
    return this.request('DELETE', path, undefined, schema);
  }

  private async request<T>(method: Method, path: string, body: unknown, schema?: z.ZodType<T>): Promise<T> {
    try {
      return await this.send(method, path, body, schema);
    } catch (e) {
      if (e instanceof HttpError && e.code === ErrorCode.CSRF_INVALID && WRITE_METHODS.includes(method)) {
        this.csrfToken = null;
        return this.send(method, path, body, schema);
      }
      throw e;
    }
  }

  private async send<T>(method: Method, path: string, body: unknown, schema?: z.ZodType<T>): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (WRITE_METHODS.includes(method)) headers[CSRF_HEADER] = await this.getCsrfToken();

    const response = await this.fetchRaw(method, path, headers, body);
    const parsed = envelope.safeParse(await response.json().catch(() => null));

    if (!parsed.success) {
      throw new HttpError(response.status, ErrorCode.INTERNAL_ERROR, 'Réponse du serveur illisible.');
    }
    if (parsed.data.status === 'ERROR') {
      const { code, message, errors } = parsed.data;
      if (response.status === 401) this.unauthorizedListeners.forEach((listener) => listener());
      throw new HttpError(response.status, code, message, errors);
    }
    return schema ? schema.parse(parsed.data.data) : (parsed.data.data as T);
  }

  private async fetchRaw(method: Method, path: string, headers: Record<string, string>, body: unknown) {
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
    const { csrfToken } = await this.send('GET', CSRF_PATH, undefined, CsrfTokenSchema);
    this.csrfToken = csrfToken;
    return csrfToken;
  }
}
