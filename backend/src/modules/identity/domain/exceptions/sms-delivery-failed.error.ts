import { DomainError } from '../../../../shared/domain/errors.js';

export class SmsDeliveryFailedError extends DomainError {
  readonly code = 'SMS_UNAVAILABLE';
  constructor() {
    super("L'envoi du SMS est impossible pour le moment. Réessayez dans quelques minutes.");
  }
}
