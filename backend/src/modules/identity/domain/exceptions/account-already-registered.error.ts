import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

/** N'est atteignable qu'avec un code valide, donc par le titulaire du numéro (D-019). */
export class AccountAlreadyRegisteredError extends BusinessRuleViolation {
  readonly code = 'ACCOUNT_ALREADY_REGISTERED';
  constructor() {
    super('Un compte existe déjà pour ce numéro : connectez-vous ou utilisez « Mot de passe oublié ».');
  }
}
