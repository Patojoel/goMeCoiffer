import { NotFoundError } from '../../../../shared/domain/errors.js';

/** 404 uniforme : identifiant inconnu ou appartenance d'un autre salon renvoient exactement le même refus. */
export class TeamMemberNotFoundError extends NotFoundError {
  constructor() {
    super('Ressource introuvable.');
  }
}
