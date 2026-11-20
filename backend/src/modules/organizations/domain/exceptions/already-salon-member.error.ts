import { ConflictError } from '../../../../shared/domain/errors.js';

export class AlreadySalonMemberError extends ConflictError {
  override readonly code = 'ALREADY_SALON_MEMBER';
  constructor(message = "Cette personne fait déjà partie de l'équipe de ce salon.") {
    super(message);
  }

  /** Défense en profondeur à l'acceptation : c'est la personne invitée qui lit ce refus. */
  static ofInvitee(): AlreadySalonMemberError {
    return new AlreadySalonMemberError(
      "Vous faites déjà partie de l'équipe de ce salon. Connectez-vous pour y travailler.",
    );
  }
}
