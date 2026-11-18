import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { PasswordRejection } from '../enums/password-rejection.enum.js';
import { PasswordRejectedError } from '../exceptions/password-rejected.error.js';
import type { CommonPasswords } from '../ports/common-passwords.port.js';

/**
 * Mot de passe choisi par un membre du personnel (D-020) : 10 à 128 caractères, pas un mot de passe
 * courant, sans le numéro de téléphone. Aucune règle de composition : la longueur protège mieux.
 */
export class NewPassword {
  private constructor(readonly value: string) {}

  static create(raw: string, phone: PhoneNumber, common: CommonPasswords): NewPassword {
    if (raw.length < 10) throw new PasswordRejectedError(PasswordRejection.TOO_SHORT);
    if (raw.length > 128) throw new PasswordRejectedError(PasswordRejection.TOO_LONG);
    if (raw.replace(/\D/g, '').includes(phone.national))
      throw new PasswordRejectedError(PasswordRejection.CONTAINS_PHONE);
    if (common.includes(raw)) throw new PasswordRejectedError(PasswordRejection.TOO_COMMON);
    return new NewPassword(raw);
  }

  toString(): string {
    return 'NewPassword[***]';
  }

  toJSON(): string {
    return this.toString();
  }
}
