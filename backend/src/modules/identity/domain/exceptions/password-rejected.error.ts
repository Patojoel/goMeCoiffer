import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';
import type { PasswordRejection } from '../enums/password-rejection.enum.js';

const PASSWORD_MESSAGES: Record<PasswordRejection, string> = {
  TOO_SHORT: 'Le mot de passe doit compter au moins 10 caractères.',
  TOO_LONG: 'Le mot de passe ne peut pas dépasser 128 caractères.',
  TOO_COMMON: 'Ce mot de passe est trop courant : choisissez une phrase propre à vous.',
  CONTAINS_PHONE: 'Le mot de passe ne doit pas contenir votre numéro de téléphone.',
};

export class PasswordRejectedError extends BusinessRuleViolation {
  readonly code: string;
  constructor(reason: PasswordRejection) {
    super(PASSWORD_MESSAGES[reason]);
    this.code = `PASSWORD_${reason}`;
  }
}
