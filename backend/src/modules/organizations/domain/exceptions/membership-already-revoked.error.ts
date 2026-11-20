import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class MembershipAlreadyRevokedError extends BusinessRuleViolation {
  readonly code = 'MEMBERSHIP_ALREADY_REVOKED';

  constructor() {
    super("Ce collaborateur a déjà été retiré de l'équipe de ce salon.");
  }
}
