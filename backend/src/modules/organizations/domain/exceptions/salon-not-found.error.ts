import { NotFoundError } from '../../../../shared/domain/errors.js';

/** Salon inexistant, d'une autre organisation ou sans appartenance active : un seul refus, qui ne dit pas lequel (RG-005-03). */
export class SalonNotFoundError extends NotFoundError {
  constructor() {
    super('Salon introuvable.');
  }
}
