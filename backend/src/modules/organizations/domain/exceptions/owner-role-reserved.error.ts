import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

/** Le rôle Propriétaire porte les droits protégés (fonds, facturation) : il ne s'attribue jamais à un collaborateur. */
export class OwnerRoleReservedError extends BusinessRuleViolation {
  readonly code = 'OWNER_ROLE_RESERVED';
  constructor() {
    super("Le rôle Propriétaire ne s'attribue pas : il appartient à la personne qui a créé l'organisation.");
  }
}
