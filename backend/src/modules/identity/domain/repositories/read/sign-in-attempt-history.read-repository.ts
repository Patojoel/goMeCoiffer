import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { SignInAttempt } from '../../value-objects/sign-in-attempt.js';

export const SIGN_IN_ATTEMPT_HISTORY = Symbol('SIGN_IN_ATTEMPT_HISTORY');
/** Lecture de l'historique pour la politique d'essais ; implémentée en SQL pur dans `application/read-repositories/`. */
export interface SignInAttemptHistory {
  /** Tous les essais du numéro des dernières 24 h, et les échecs de l'adresse réseau de la dernière heure. */
  recentAttempts(phone: PhoneNumber, networkAddress: string, now: Date): Promise<readonly SignInAttempt[]>;
}
