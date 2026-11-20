import type { SalonMembership } from '../../aggregates/salon-membership.js';

export const SALON_MEMBERSHIP_REPOSITORY = Symbol('SALON_MEMBERSHIP_REPOSITORY');
export interface SalonMembershipRepository {
  /** `AlreadySalonMemberError` si le compte a déjà une appartenance dans ce salon, même à deux requêtes. */
  add(membership: SalonMembership): Promise<void>;
}
