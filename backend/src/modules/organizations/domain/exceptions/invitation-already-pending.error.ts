import { ConflictError } from '../../../../shared/domain/errors.js';

/** 409 : la garantie ultime est l'index unique partiel `(salon_id, phone) WHERE status = 'PENDING'`. */
export class InvitationAlreadyPendingError extends ConflictError {
  override readonly code = 'INVITATION_ALREADY_PENDING';
  constructor() {
    super('Une invitation est déjà en attente pour ce numéro. Annulez-la pour en envoyer une nouvelle.');
  }
}
