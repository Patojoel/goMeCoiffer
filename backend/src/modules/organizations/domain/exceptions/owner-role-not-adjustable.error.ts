import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class OwnerRoleNotAdjustableError extends BusinessRuleViolation {
  readonly code = 'OWNER_ROLE_NOT_ADJUSTABLE';

  constructor() {
    super('Seuls les quatre rôles de collaborateur du salon peuvent être réglés.');
  }
}

