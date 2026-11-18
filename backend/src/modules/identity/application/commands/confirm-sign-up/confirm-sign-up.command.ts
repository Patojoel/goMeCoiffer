import { Command } from '@nestjs/cqrs';
import type { BusinessRuleViolation } from '../../../../../shared/domain/errors.js';

/**
 * Un code refusé n'est pas une exception : l'essai doit être enregistré, et une exception annulerait la
 * transaction (essais illimités). Le refus est renvoyé, la couche HTTP le transforme en erreur après le commit.
 */
export type SignUpResult =
  | { readonly status: 'SIGNED_UP'; readonly userId: string; readonly outcome: 'CREATED' | 'COMPLETED' }
  | { readonly status: 'REFUSED'; readonly refusal: BusinessRuleViolation };

/** UC-001, intention 2 : prouver le numéro avec le code et créer (ou compléter) son compte propriétaire. */
export class ConfirmSignUp extends Command<SignUpResult> {
  readonly phone: string;
  readonly code: string;
  readonly name: string;
  readonly email: string | null;
  readonly password: string;

  constructor(input: { phone: string; code: string; name: string; email: string | null; password: string }) {
    super();
    this.phone = input.phone;
    this.code = input.code;
    this.name = input.name;
    this.email = input.email;
    this.password = input.password;
  }

  /** Une commande journalisée ou sérialisée ne montre jamais le mot de passe ni le code. */
  toJSON() {
    return { phone: this.phone, name: this.name, email: this.email, code: '***', password: '***' };
  }
}
