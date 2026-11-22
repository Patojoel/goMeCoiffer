import type { FieldError } from '@gomecoiffer/contracts';

export type ApiFailure = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly errors?: readonly FieldError[];
};

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

export function toApiFailure(error: unknown): ApiFailure {
  if (error instanceof HttpError) {
    return error.errors.length > 0
      ? { status: error.status, code: error.code, message: error.message, errors: error.errors }
      : { status: error.status, code: error.code, message: error.message };
  }
  return {
    status: 0,
    code: 'UNKNOWN',
    message: 'Une erreur inattendue est survenue.',
  };
}
