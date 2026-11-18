import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

/** Code déjà utilisé, remplacé par un plus récent, ou jamais demandé : le même message pour tous. */
export class OtpNoLongerValidError extends BusinessRuleViolation {
  readonly code = 'OTP_NO_LONGER_VALID';
  constructor() {
    super("Ce code n'est plus valable. Demandez un nouveau code.");
  }
}
