import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class SelfSystemRoleModificationError extends BusinessRuleViolation {
  readonly code = 'SELF_SYSTEM_ROLE_MODIFICATION';

  constructor() {
    super('Vous ne pouvez pas modifier vos propres rôles : demandez à un autre Super Administrateur.');
  }
}

