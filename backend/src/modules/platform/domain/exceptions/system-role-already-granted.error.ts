import { ConflictError } from '../../../../shared/domain/errors.js';

export class SystemRoleAlreadyGrantedError extends ConflictError {
  override readonly code = 'SYSTEM_ROLE_ALREADY_GRANTED';

  constructor() {
    super('Cette personne possède déjà ce rôle système.');
  }
}

