import type { OwnerCandidate } from '../../value-objects/owner-candidate.js';

export const OWNER_CANDIDATES = Symbol('OWNER_CANDIDATES');
export interface OwnerCandidates {
  /** `NotFoundError` si le compte a disparu. */
  of(userId: string): Promise<OwnerCandidate>;
}
