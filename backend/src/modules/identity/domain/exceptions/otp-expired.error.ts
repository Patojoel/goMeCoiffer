import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class OtpExpiredError extends BusinessRuleViolation {
  readonly code = 'OTP_EXPIRED';
  constructor() {
    super('Ce code a expiré. Demandez-en un nouveau.');
  }
}
