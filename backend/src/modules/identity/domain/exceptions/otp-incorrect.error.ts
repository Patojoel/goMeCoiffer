import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class OtpIncorrectError extends BusinessRuleViolation {
  readonly code = 'OTP_INCORRECT';
  constructor(attemptsLeft: number) {
    super(`Code incorrect. Il vous reste ${attemptsLeft} essai${attemptsLeft > 1 ? 's' : ''}.`);
  }
}
