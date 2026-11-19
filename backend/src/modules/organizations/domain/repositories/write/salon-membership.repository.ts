import type { SalonMembership } from '../../aggregates/salon-membership.js';

export const SALON_MEMBERSHIP_REPOSITORY = Symbol('SALON_MEMBERSHIP_REPOSITORY');
export interface SalonMembershipRepository {
  add(membership: SalonMembership): Promise<void>;
}
