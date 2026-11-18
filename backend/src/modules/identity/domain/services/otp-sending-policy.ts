import { OtpResendTooSoonError } from '../exceptions/otp-resend-too-soon.error.js';
import { OtpTooManyRequestsError } from '../exceptions/otp-too-many-requests.error.js';
import type { CodeSend } from '../value-objects/code-send.js';

export const RESEND_DELAY_SECONDS = 60;
export const MAX_CODES_PER_HOUR = 5;
export const MAX_CODES_PER_DAY = 10;
export const MAX_FAILED_ATTEMPTS_PER_DAY = 10;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Règles d'envoi des codes SMS pour un numéro et un motif (D-021, D-023) : 60 s entre deux codes, 5 codes par
 * heure, 10 par 24 h, et plus aucun code après 10 codes faux en 24 h (borne la force brute dans la durée).
 * `history` : les envois réussis des dernières 24 h.
 */
export function assertCanSendCode(history: readonly CodeSend[], now: Date): void {
  const age = (send: CodeSend) => now.getTime() - send.sentAt.getTime();
  const lastDay = history.filter((s) => age(s) < DAY_MS);
  const lastHour = lastDay.filter((s) => age(s) < HOUR_MS);
  const failures = lastDay.reduce((sum, s) => sum + s.failedAttempts, 0);

  if (lastHour.length >= MAX_CODES_PER_HOUR || lastDay.length >= MAX_CODES_PER_DAY)
    throw new OtpTooManyRequestsError();
  if (failures >= MAX_FAILED_ATTEMPTS_PER_DAY) throw new OtpTooManyRequestsError();

  const elapsedSeconds = Math.floor(Math.min(...lastHour.map(age), Number.POSITIVE_INFINITY) / 1000);
  if (elapsedSeconds < RESEND_DELAY_SECONDS)
    throw new OtpResendTooSoonError(RESEND_DELAY_SECONDS - elapsedSeconds);
}

export const sendingWindowStart = (now: Date) => new Date(now.getTime() - DAY_MS);
