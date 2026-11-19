import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class InvitationNoLongerPendingError extends BusinessRuleViolation {
  readonly code = 'INVITATION_NO_LONGER_PENDING';
  constructor() {
    super("Cette invitation n'est plus en attente : elle a été acceptée, annulée ou elle a expiré.");
  }
}
