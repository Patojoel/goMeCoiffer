import type { SignInAttempt } from '../value-objects/sign-in-attempt.js';

export const PHONE_BURST_FAILURES = 5;
export const PHONE_BURST_WINDOW_MS = 15 * 60_000;
export const PHONE_BLOCK_MS = 15 * 60_000;
export const PHONE_DAILY_FAILURES = 20;
export const PHONE_DAILY_WINDOW_MS = 24 * 3_600_000;
export const NETWORK_FAILURES = 30;
export const NETWORK_WINDOW_MS = 3_600_000;

export type SignInBlock =
  | { readonly reason: 'PHONE_SHORT'; readonly minutes: number }
  | { readonly reason: 'PHONE_DAILY' }
  | { readonly reason: 'NETWORK' };

interface Assessment {
  readonly phone: string;
  readonly networkAddress: string;
  /** Historique utile : les essais du numéro (24 h) et les échecs de l'adresse (1 h), dans le désordre. */
  readonly attempts: readonly SignInAttempt[];
  readonly fromKnownDevice: boolean;
  readonly now: Date;
}

/**
 * Règles de blocage de la connexion (D-025, RG-002-04 à -09), seulement contre les appareils non reconnus,
 * et seulement sur les échecs saisis depuis des appareils non reconnus. Le blocage de 24 h l'emporte sur celui
 * de 15 minutes : il annonce l'attente la plus longue.
 */
export function assessSignIn({
  phone,
  networkAddress,
  attempts,
  fromKnownDevice,
  now,
}: Assessment): SignInBlock | null {
  if (fromKnownDevice) return null;
  const countedFailures = attempts.filter((a) => !a.succeeded && !a.fromKnownDevice);
  const ageMs = (a: SignInAttempt) => now.getTime() - a.at.getTime();

  const phoneAttempts = attempts.filter((a) => a.phone === phone);
  const phoneFailures = countedFailures.filter((a) => a.phone === phone);

  if (phoneFailures.filter((a) => ageMs(a) < PHONE_DAILY_WINDOW_MS).length >= PHONE_DAILY_FAILURES)
    return { reason: 'PHONE_DAILY' };

  const shortBlockEnd = phoneBlockEnd(phoneAttempts);
  if (shortBlockEnd !== null && now.getTime() < shortBlockEnd)
    return { reason: 'PHONE_SHORT', minutes: Math.ceil((shortBlockEnd - now.getTime()) / 60_000) };

  const networkFailures = countedFailures.filter(
    (a) => a.networkAddress === networkAddress && ageMs(a) < NETWORK_WINDOW_MS,
  );
  if (networkFailures.length >= NETWORK_FAILURES) return { reason: 'NETWORK' };
  return null;
}

/** Fin du blocage posé par le dernier groupe de 5 échecs en moins de 15 minutes, depuis la dernière réussite. */
function phoneBlockEnd(phoneAttempts: readonly SignInAttempt[]): number | null {
  const byTime = [...phoneAttempts].sort((a, b) => a.at.getTime() - b.at.getTime());
  const lastSuccess = byTime.findLast((a) => a.succeeded)?.at.getTime() ?? Number.NEGATIVE_INFINITY;
  const times = byTime
    .filter((a) => !a.succeeded && !a.fromKnownDevice && a.at.getTime() >= lastSuccess)
    .map((a) => a.at.getTime());

  let end: number | null = null;
  for (let i = PHONE_BURST_FAILURES - 1; i < times.length; i++) {
    const fifthFailure = times[i]!;
    if (fifthFailure - times[i - PHONE_BURST_FAILURES + 1]! < PHONE_BURST_WINDOW_MS)
      end = fifthFailure + PHONE_BLOCK_MS;
  }
  return end;
}
