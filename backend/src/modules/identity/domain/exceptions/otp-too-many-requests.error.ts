import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class OtpTooManyRequestsError extends BusinessRuleViolation {
  readonly code = 'OTP_TOO_MANY_REQUESTS';
  constructor() {
    super("Trop de codes demandés pour ce numéro. Réessayez dans une heure ou contactez l'assistance.");
  }
}
