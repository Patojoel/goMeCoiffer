import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class PhoneProofRequiredError extends BusinessRuleViolation {
  readonly code = 'PHONE_PROOF_REQUIRED';
  constructor() {
    super('Votre vérification a expiré : demandez un nouveau code pour continuer.');
  }
}
