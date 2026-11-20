import type { Salon } from '../../aggregates/salon.js';

export const SALON_REPOSITORY = Symbol('SALON_REPOSITORY');
export interface SalonRepository {
  /** `SalonNameAlreadyExistsError` si un salon de la même organisation porte déjà ce nom (insensible à la casse). */
  add(salon: Salon): Promise<void>;
  existsWithNameInOrganization(organizationId: string, name: string): Promise<boolean>;
}
