import type { BusinessRuleViolation } from '../../../../../shared/domain/errors.js';

/** Après l'inscription, le propriétaire crée son organisation (PRD §7, étape 2). */
export type SignUpNextStep = 'CREATE_ORGANIZATION';

/**
 * Un code refusé n'est pas une exception : l'essai doit être enregistré, et une exception annulerait la
 * transaction (essais illimités). Le refus est renvoyé, la couche HTTP le transforme en erreur après le commit.
 */
export type ConfirmSignUpResponse =
  | {
      readonly status: 'SIGNED_UP';
      readonly userId: string;
      readonly outcome: 'CREATED' | 'COMPLETED';
      readonly nextStep: SignUpNextStep;
    }
  | { readonly status: 'REFUSED'; readonly refusal: BusinessRuleViolation };
