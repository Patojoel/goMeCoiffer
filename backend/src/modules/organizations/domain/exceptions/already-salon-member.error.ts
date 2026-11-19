import { ConflictError } from '../../../../shared/domain/errors.js';

export class AlreadySalonMemberError extends ConflictError {
  override readonly code = 'ALREADY_SALON_MEMBER';
  constructor() {
    super("Cette personne fait déjà partie de l'équipe de ce salon.");
  }
}
