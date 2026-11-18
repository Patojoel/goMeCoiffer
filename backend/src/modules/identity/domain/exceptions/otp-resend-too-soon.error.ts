import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class OtpResendTooSoonError extends BusinessRuleViolation {
  readonly code = 'OTP_RESEND_TOO_SOON';
  constructor(readonly secondsLeft: number) {
    super(`Un code vient d'être envoyé. Vous pourrez en demander un autre dans ${secondsLeft} secondes.`);
  }
}
