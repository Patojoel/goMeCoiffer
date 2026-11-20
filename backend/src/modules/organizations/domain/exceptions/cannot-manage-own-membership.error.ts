import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class CannotManageOwnMembershipError extends BusinessRuleViolation {
  readonly code = 'CANNOT_MANAGE_OWN_MEMBERSHIP';

  constructor() {
    super(
      "Vous ne pouvez pas modifier votre propre rôle ni vous retirer vous-même de l'équipe : demandez au propriétaire.",
    );
  }
}
