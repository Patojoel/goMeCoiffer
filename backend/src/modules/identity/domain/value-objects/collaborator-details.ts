import { InvalidValueError } from '../../../../shared/domain/errors.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { TermsNotAcceptedError } from '../exceptions/terms-not-accepted.error.js';
import type { CommonPasswords } from '../ports/common-passwords.port.js';
import { NewPassword } from './new-password.js';

/** Ce que doit fournir une personne invitée qui n'a pas encore de compte : nom, mot de passe (D-020), conditions (D-022). */
export class CollaboratorDetails {
  private constructor(
    readonly name: string,
    readonly password: NewPassword,
  ) {}

  static create(
    raw: { name: string; password: string; termsAccepted: boolean },
    phone: PhoneNumber,
    common: CommonPasswords,
  ): CollaboratorDetails {
    const name = raw.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80)
      throw new InvalidValueError('Votre nom doit compter de 2 à 80 caractères.');
    if (!raw.termsAccepted) throw new TermsNotAcceptedError();
    return new CollaboratorDetails(name, NewPassword.create(raw.password, phone, common));
  }
}
