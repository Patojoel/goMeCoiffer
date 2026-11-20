import { NotFoundError } from '../../../../shared/domain/errors.js';

export class StaffAccountNotFoundError extends NotFoundError {
  override readonly code = 'STAFF_ACCOUNT_NOT_FOUND';

  constructor() {
    super(
      "Aucun compte du personnel n'existe pour ce numéro. Demandez à la personne de créer son compte d'abord.",
    );
  }
}

