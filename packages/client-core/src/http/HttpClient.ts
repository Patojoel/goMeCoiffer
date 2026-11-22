import type { z } from 'zod';

export interface HttpClient {
  get<T = unknown>(path: string, schema?: z.ZodType<T>): Promise<T>;
  post<T = unknown>(path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T>;
  put<T = unknown>(path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown, schema?: z.ZodType<T>): Promise<T>;
  delete<T = unknown>(path: string, schema?: z.ZodType<T>): Promise<T>;
  onUnauthorized(listener: () => void): () => void;
}
