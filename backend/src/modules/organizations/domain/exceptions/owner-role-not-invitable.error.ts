import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

/** Le rôle Propriétaire ne se donne jamais par invitation (D-042). */
export class OwnerRoleNotInvitableError extends BusinessRuleViolation {
  readonly code = 'OWNER_ROLE_NOT_INVITABLE';
  constructor() {
    super('Le rôle Propriétaire ne se donne pas par invitation.');
  }
}
