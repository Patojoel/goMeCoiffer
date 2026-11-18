import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

/** Même refus pour un numéro inconnu, un compte client léger et un mot de passe faux (D-019). */
export class InvalidCredentialsError extends BusinessRuleViolation {
  readonly code = 'INVALID_CREDENTIALS';
  constructor() {
    super('Numéro ou mot de passe incorrect.');
  }
}
