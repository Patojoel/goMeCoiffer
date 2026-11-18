import { OtpResendTooSoonError, OtpTooManyRequestsError } from './errors.js';

export const RESEND_DELAY_SECONDS = 60;
export const MAX_CODES_PER_HOUR = 5;
const HOUR_MS = 3_600_000;

/**
 * Règles d'envoi des codes SMS pour un numéro (D-021), tous motifs confondus : 60 s entre deux codes,
 * 5 codes au plus sur une heure glissante. `previousSends` : heures d'envoi réussies de ce numéro.
 */
export function assertCanSendCode(previousSends: readonly Date[], now: Date): void {
  const recent = previousSends.filter((sentAt) => now.getTime() - sentAt.getTime() < HOUR_MS);
  if (recent.length >= MAX_CODES_PER_HOUR) throw new OtpTooManyRequestsError();

  const last = Math.max(...recent.map((d) => d.getTime()), Number.NEGATIVE_INFINITY);
  const elapsedSeconds = Math.floor((now.getTime() - last) / 1000);
  if (elapsedSeconds < RESEND_DELAY_SECONDS)
    throw new OtpResendTooSoonError(RESEND_DELAY_SECONDS - elapsedSeconds);
}

export const sendingWindowStart = (now: Date) => new Date(now.getTime() - HOUR_MS);
