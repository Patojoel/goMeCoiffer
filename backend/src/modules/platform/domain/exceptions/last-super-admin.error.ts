import { ConflictError } from '../../../../shared/domain/errors.js';

export class LastSuperAdminError extends ConflictError {
  override readonly code = 'LAST_SUPER_ADMIN';

  constructor() {
    super(
      "Impossible de retirer le dernier Super Administrateur. Attribuez d'abord ce rôle à une autre personne.",
    );
  }
}

