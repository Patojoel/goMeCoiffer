import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class PendingInvitationsLimitError extends BusinessRuleViolation {
  readonly code = 'PENDING_INVITATIONS_LIMIT';
  constructor(limit: number) {
    super(
      `Vous avez déjà ${limit} invitations en attente. Annulez celles qui ne servent plus avant d'en envoyer d'autres.`,
    );
  }
}
