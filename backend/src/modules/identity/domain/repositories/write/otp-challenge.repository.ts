import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { OtpChallenge } from '../../aggregates/otp-challenge.js';
import type { OtpPurpose } from '../../enums/otp-purpose.enum.js';

export const OTP_CHALLENGE_REPOSITORY = Symbol('OTP_CHALLENGE_REPOSITORY');
export interface OtpChallengeRepository {
  /**
   * Sérialise jusqu'à la fin de la transaction les demandes de code d'un même numéro : sans cela, des demandes
   * simultanées lisent toutes un historique vide et envoient chacune un SMS.
   * Suppose l'isolation READ COMMITTED (défaut de PostgreSQL) : la lecture de l'historique faite après le verrou
   * voit les envois commités entre-temps. En REPEATABLE READ, la photo de la base serait prise avant le verrou.
   */
  lockSendingFor(phone: PhoneNumber): Promise<void>;
  findActive(phone: PhoneNumber, purpose: OtpPurpose): Promise<OtpChallenge | null>;
  save(challenge: OtpChallenge): Promise<void>;
}
