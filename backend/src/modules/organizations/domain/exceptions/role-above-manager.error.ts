import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

export class RoleAboveManagerError extends BusinessRuleViolation {
  readonly code = 'ROLE_ABOVE_MANAGER';

  constructor() {
    super(
      "Ce collaborateur ou ce rôle dispose de droits que vous n'avez pas dans ce salon : demandez au propriétaire.",
    );
  }
}
