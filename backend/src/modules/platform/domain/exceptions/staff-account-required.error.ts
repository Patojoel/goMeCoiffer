import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class StaffAccountRequiredError extends BusinessRuleViolation {
  readonly code = 'STAFF_ACCOUNT_REQUIRED';

  constructor() {
    super(
      "Ce compte n'a pas de mot de passe : seuls les comptes du personnel peuvent recevoir un rôle système.",
    );
  }
}

