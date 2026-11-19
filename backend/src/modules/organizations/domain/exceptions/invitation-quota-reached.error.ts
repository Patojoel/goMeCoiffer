import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class InvitationQuotaReachedError extends BusinessRuleViolation {
  readonly code = 'INVITATION_QUOTA_REACHED';
  constructor() {
    super(
      "Vous avez envoyé beaucoup d'invitations aujourd'hui. Réessayez demain ou contactez l'assistance GoMeCoiffer.",
    );
  }
}
