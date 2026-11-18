import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { OtpPurpose } from '../../enums/otp-purpose.enum.js';
import type { CodeSend } from '../../value-objects/code-send.js';

export const OTP_SEND_HISTORY = Symbol('OTP_SEND_HISTORY');
/**
 * Lecture des codes déjà envoyés, pour les limites d'envoi (D-021, D-023). Implémentée en SQL pur dans
 * `application/read-repositories/` : elle ne charge aucun agrégat.
 */
export interface OtpSendHistory {
  /** Envois de ce numéro pour ce motif depuis `since`, avec le nombre de codes faux saisis pour chacun. */
  recentSends(phone: PhoneNumber, purpose: OtpPurpose, since: Date): Promise<readonly CodeSend[]>;
}
