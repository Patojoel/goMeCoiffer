import { ConflictError } from '../../../../shared/domain/errors.js';

/** Un utilisateur ne possède qu'une organisation (D-035) ; 409 : la garantie ultime est l'unicité en base. */
export class OrganizationAlreadyExistsError extends ConflictError {
  override readonly code = 'ORGANIZATION_ALREADY_EXISTS';
  constructor() {
    super('Vous avez déjà une organisation. Ouvrez votre salon pour continuer.');
  }
}
