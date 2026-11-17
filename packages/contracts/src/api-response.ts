import { z } from 'zod';

/** Codes d'erreur transverses posés par le DomainExceptionFilter ; les règles métier ajoutent les leurs. */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  CONCURRENCY_CONFLICT: 'CONCURRENCY_CONFLICT',
  SLOT_NO_LONGER_AVAILABLE: 'SLOT_NO_LONGER_AVAILABLE',
  CSRF_INVALID: 'CSRF_INVALID',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const FieldErrorSchema = z.object({ path: z.string(), message: z.string() });
export type FieldError = z.infer<typeof FieldErrorSchema>;

export type ApiSuccess<T> = { readonly status: 'OK'; readonly data: T };
export type ApiError = {
  readonly status: 'ERROR';
  readonly code: string;
  readonly message: string;
  readonly errors?: readonly FieldError[];
};
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const apiResponseSchema = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion('status', [
    z.object({ status: z.literal('OK'), data }),
    z.object({
      status: z.literal('ERROR'),
      code: z.string(),
      message: z.string(),
      errors: z.array(FieldErrorSchema).optional(),
    }),
  ]);
