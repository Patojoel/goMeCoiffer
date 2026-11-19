import type { BusinessRuleViolation } from '../../../../../shared/domain/errors.js';

/**
 * Un refus n'est pas une exception : l'essai doit être enregistré, et une exception annulerait la transaction
 * (essais illimités). Le refus est renvoyé, la couche HTTP le lève après le commit.
 */
export type SignInResponse =
  | {
      readonly status: 'SIGNED_IN';
      readonly userId: string;
      /** Version des identifiants lue avec le compte, à recopier dans la session : la garantie des sessions fermées. */
      readonly credentialsVersion: number;
      /** Contenu du cookie d'appareil reconnu : un jeton par compte, celui de ce compte renouvelé. */
      readonly deviceTokens: readonly string[];
    }
  | { readonly status: 'REFUSED'; readonly refusal: BusinessRuleViolation };
