import { NotFoundError } from '../../../../shared/domain/errors.js';

export class SystemRoleNotAssignedError extends NotFoundError {
  override readonly code = 'SYSTEM_ROLE_NOT_ASSIGNED';

  constructor() {
    super("Ce rôle système n'est pas attribué à cette personne.");
  }
}

