import type { Salon } from '../../aggregates/salon.js';

export const SALON_REPOSITORY = Symbol('SALON_REPOSITORY');
export interface SalonRepository {
  add(salon: Salon): Promise<void>;
}
