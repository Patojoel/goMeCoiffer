import { ConflictError } from '../../../../shared/domain/errors.js';

/** Unicité du nom de salon au sein d'une organisation, insensible à la casse (D-035, RG-010-02). */
export class SalonNameAlreadyExistsError extends ConflictError {
  override readonly code = 'SALON_NAME_ALREADY_EXISTS';
  constructor() {
    super('Votre organisation possède déjà un salon portant ce nom.');
  }
}

