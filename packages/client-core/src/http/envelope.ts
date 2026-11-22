import { apiResponseSchema, ErrorCode } from '@gomecoiffer/contracts';
import { z } from 'zod';
import { HttpError } from './HttpError.js';

const envelopeSchema = apiResponseSchema(z.unknown());

export function assertSafeApiPath(path: string): void {
  if (!path.startsWith('/') || path.startsWith('//') || /[\s\\]/.test(path)) {
    throw new HttpError(0, ErrorCode.INTERNAL_ERROR, 'Chemin API invalide.');
  }
}

export const encodePathSegment = (segment: string): string =>
  encodeURIComponent(segment).replace(/\./g, '%2E');

export function parseApiEnvelope<T>(status: number, body: unknown, schema?: z.ZodType<T>): T {
  const parsed = envelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(status, ErrorCode.INTERNAL_ERROR, 'Réponse du serveur illisible.');
  }
  if (parsed.data.status === 'ERROR') {
    throw new HttpError(status, parsed.data.code, parsed.data.message, parsed.data.errors);
  }
  if (!schema) return parsed.data.data as T;

  const validated = schema.safeParse(parsed.data.data);
  if (!validated.success) {
    throw new HttpError(status, ErrorCode.INTERNAL_ERROR, 'Réponse du serveur illisible.');
  }
  return validated.data;
}
