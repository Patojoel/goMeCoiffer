import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

/** Un compte client léger (sans mot de passe) ne crée pas d'organisation (D-038). */
export class OwnerAccountRequiredError extends BusinessRuleViolation {
  readonly code = 'OWNER_ACCOUNT_REQUIRED';
  constructor() {
    super("Créez d'abord votre compte salon avec un mot de passe, puis votre organisation.");
  }
}
