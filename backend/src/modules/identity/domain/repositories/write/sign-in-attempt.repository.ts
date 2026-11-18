import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { SignInAttempt } from '../../value-objects/sign-in-attempt.js';

export const SIGN_IN_ATTEMPT_REPOSITORY = Symbol('SIGN_IN_ATTEMPT_REPOSITORY');
export interface SignInAttemptRepository {
  /** Fait passer les essais d'un même numéro un à un (verrou libéré au commit), avant de lire l'historique. */
  lockSignInsFor(phone: PhoneNumber): Promise<void>;
  add(attempt: SignInAttempt): Promise<void>;
  /** Supprime les essais antérieurs à `before` ; renvoie leur nombre. */
  purgeBefore(before: Date): Promise<number>;
}
