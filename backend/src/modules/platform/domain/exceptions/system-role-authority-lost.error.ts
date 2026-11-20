import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class SystemRoleAuthorityLostError extends BusinessRuleViolation {
  readonly code = 'SYSTEM_ROLE_AUTHORITY_LOST';

  constructor() {
    super('Action réservée aux Super Administrateurs : vous ne l’êtes plus.');
  }
}
