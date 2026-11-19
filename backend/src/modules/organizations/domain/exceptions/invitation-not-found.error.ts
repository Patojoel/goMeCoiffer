import { NotFoundError } from '../../../../shared/domain/errors.js';

/** Invitation inexistante ou d'un autre salon : un seul refus, qui ne dit pas lequel (RG-006-13). */
export class InvitationNotFoundError extends NotFoundError {
  constructor() {
    super('Ressource introuvable.');
  }
}
