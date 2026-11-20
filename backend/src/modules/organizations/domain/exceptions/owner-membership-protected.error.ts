import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class OwnerMembershipProtectedError extends BusinessRuleViolation {
  readonly code = 'OWNER_MEMBERSHIP_PROTECTED';

  constructor() {
    super("Le propriétaire du salon ne peut ni changer de rôle ni être retiré de l'équipe.");
  }
}
