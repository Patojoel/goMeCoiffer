import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

/** Défense en profondeur : un compte sans mot de passe (client léger) ne s'en choisit pas un par la réinitialisation. */
export class NoPasswordToResetError extends BusinessRuleViolation {
  readonly code = 'NO_PASSWORD_TO_RESET';
  constructor() {
    super("Ce numéro n'a pas de compte salon : créez-le depuis « Créer mon salon ».");
  }
}
