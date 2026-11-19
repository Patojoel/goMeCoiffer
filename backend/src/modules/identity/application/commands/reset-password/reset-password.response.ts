import type { BusinessRuleViolation } from '../../../../../shared/domain/errors.js';

/**
 * Un code refusé n'est pas une exception : l'essai doit être enregistré, et une exception annulerait la
 * transaction (essais illimités). Le refus est renvoyé, la couche HTTP le lève après le commit.
 */
export type ResetPasswordResponse =
  | {
      readonly status: 'PASSWORD_RESET';
      readonly userId: string;
      /** Version des identifiants après la réinitialisation, à recopier dans la session neuve. */
      readonly credentialsVersion: number;
      /** Contenu du cookie d'appareil reconnu : un jeton par compte, celui de ce compte renouvelé. */
      readonly deviceTokens: readonly string[];
    }
  | { readonly status: 'REFUSED'; readonly refusal: BusinessRuleViolation };
