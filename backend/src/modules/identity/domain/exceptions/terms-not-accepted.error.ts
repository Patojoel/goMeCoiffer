import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class TermsNotAcceptedError extends BusinessRuleViolation {
  readonly code = 'TERMS_NOT_ACCEPTED';
  constructor() {
    super("Acceptez les conditions d'utilisation pour continuer.");
  }
}
