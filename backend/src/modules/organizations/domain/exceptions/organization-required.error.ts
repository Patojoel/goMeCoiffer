import { BusinessRuleViolation } from '../../../../shared/domain/errors.js';

/** Un propriétaire doit fonder son organisation (UC-004) avant d'y ajouter un salon (RG-010-01). */
export class OrganizationRequiredError extends BusinessRuleViolation {
  readonly code = 'ORGANIZATION_REQUIRED';
  constructor() {
    super("Créez d'abord votre organisation et votre premier salon.");
  }
}

