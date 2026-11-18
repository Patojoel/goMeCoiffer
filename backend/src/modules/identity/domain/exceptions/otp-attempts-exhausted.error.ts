import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class OtpAttemptsExhaustedError extends BusinessRuleViolation {
  readonly code = 'OTP_ATTEMPTS_EXHAUSTED';
  constructor() {
    super("Trop d'essais. Demandez un nouveau code.");
  }
}
