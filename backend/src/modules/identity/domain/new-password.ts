import type { PhoneNumber } from '../../../shared/domain/phone-number.js';
import { PasswordRejectedError } from './errors.js';

/** Liste des mots de passe courants, tenue par l'infrastructure (fichier de données). */
export interface CommonPasswords {
  includes(candidate: string): boolean;
}

/**
 * Mot de passe choisi par un membre du personnel (D-020) : 10 à 128 caractères, pas un mot de passe
 * courant, sans le numéro de téléphone. Aucune règle de composition : la longueur protège mieux.
 */
export class NewPassword {
  private constructor(readonly value: string) {}

  static create(raw: string, phone: PhoneNumber, common: CommonPasswords): NewPassword {
    if (raw.length < 10) throw new PasswordRejectedError('TOO_SHORT');
    if (raw.length > 128) throw new PasswordRejectedError('TOO_LONG');
    if (raw.replace(/\D/g, '').includes(phone.national)) throw new PasswordRejectedError('CONTAINS_PHONE');
    if (common.includes(raw)) throw new PasswordRejectedError('TOO_COMMON');
    return new NewPassword(raw);
  }

  toString(): string {
    return 'NewPassword[***]';
  }

  toJSON(): string {
    return this.toString();
  }
}
