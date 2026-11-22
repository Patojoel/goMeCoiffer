import { ErrorCode } from '@gomecoiffer/contracts';
import type { MessageKey } from '../i18n/fr.js';
import { t } from '../i18n/i18n.js';

const CODE_TO_KEY = {
  [ErrorCode.UNAUTHENTICATED]: 'errors.unauthenticated.staff',
  [ErrorCode.FORBIDDEN]: 'errors.forbidden.permission',
  [ErrorCode.NOT_FOUND]: 'errors.notFound',
  [ErrorCode.CONFLICT]: 'errors.conflict',
  [ErrorCode.CONCURRENCY_CONFLICT]: 'errors.conflict',
  [ErrorCode.SLOT_NO_LONGER_AVAILABLE]: 'errors.slotNoLongerAvailable',
  [ErrorCode.TOO_MANY_REQUESTS]: 'errors.tooManyRequests',
  STAFF_SIGN_IN_REQUIRED: 'errors.forbidden.staffSignInRequired',
  NETWORK_ERROR: 'errors.network',
} as const satisfies Record<string, MessageKey>;

export function codeToMessage(code: string): MessageKey {
  if (code in CODE_TO_KEY) {
    return CODE_TO_KEY[code as keyof typeof CODE_TO_KEY];
  }
  return 'errors.generic';
}

function isApiFailureLike(error: unknown): error is { status: number; code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'code' in error &&
    'message' in error &&
    typeof error.status === 'number' &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  );
}

export function resolveApiErrorMessage(error: unknown): string {
  if (!isApiFailureLike(error)) {
    return t('errors.generic');
  }
  if (
    error.status === 0 ||
    error.status >= 500 ||
    error.code === ErrorCode.UNAUTHENTICATED ||
    error.code === 'UNKNOWN'
  ) {
    return t(codeToMessage(error.code));
  }
  if (error.status >= 400 && error.status < 500 && error.message.trim().length > 0) {
    return error.message;
  }
  return t(codeToMessage(error.code));
}
