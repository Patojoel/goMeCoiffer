import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class PermissionNotAdjustableError extends BusinessRuleViolation {
  readonly code = 'PERMISSION_NOT_ADJUSTABLE';

  constructor(permission: string) {
    super(`La permission « ${permission} » ne fait pas partie des permissions ajustables du salon.`);
  }
}

