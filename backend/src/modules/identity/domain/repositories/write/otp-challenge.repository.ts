import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { OtpChallenge } from '../../aggregates/otp-challenge.js';
import type { OtpPurpose } from '../../enums/otp-purpose.enum.js';

export const OTP_CHALLENGE_REPOSITORY = Symbol('OTP_CHALLENGE_REPOSITORY');
export interface OtpChallengeRepository {
  /**
   * Sérialise jusqu'à la fin de la transaction les demandes de code d'un même numéro : sans cela, des demandes
   * simultanées lisent toutes un historique vide et envoient chacune un SMS.
   */
  lockSendingFor(phone: PhoneNumber): Promise<void>;
  findActive(phone: PhoneNumber, purpose: OtpPurpose): Promise<OtpChallenge | null>;
  save(challenge: OtpChallenge): Promise<void>;
}
