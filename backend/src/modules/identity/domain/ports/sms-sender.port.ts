import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';

export const SMS_SENDER = Symbol('SMS_SENDER');
export interface SmsSender {
  /** Lève SmsDeliveryFailedError si le fournisseur refuse ou ne répond pas. */
  send(to: PhoneNumber, text: string): Promise<void>;
}
