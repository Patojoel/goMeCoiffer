import type { Organization } from '../../aggregates/organization.js';

export const ORGANIZATION_REPOSITORY = Symbol('ORGANIZATION_REPOSITORY');
export interface OrganizationRepository {
  /** `OrganizationAlreadyExistsError` si le propriétaire en possède déjà une, même face à une demande simultanée. */
  add(organization: Organization): Promise<void>;
  findByOwner(ownerUserId: string): Promise<Organization | null>;
}
