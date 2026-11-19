import type { SalonDraft } from '../../domain/aggregates/organization.js';
import type { OwnerCandidate } from '../../domain/value-objects/owner-candidate.js';

export const MIREILLE_ID = '0195f000-0000-7000-8000-00000000b001';
export const PAUL_ID = '0195f000-0000-7000-8000-00000000b002';
export const CLARISSE_ID = '0195f000-0000-7000-8000-00000000b003';

export const aSalonDraft = (over: Partial<SalonDraft> = {}): SalonDraft => ({
  name: 'Go Beauty Akwa',
  type: 'MIXED',
  city: 'Douala',
  district: 'Akwa',
  landmark: 'Rue Joffre, face à la pharmacie du Centre',
  phone: '6 99 88 77 66',
  ...over,
});

export const anOwnerCandidate = (over: Partial<OwnerCandidate> = {}): OwnerCandidate => ({
  userId: MIREILLE_ID,
  hasPassword: true,
  ownsOrganization: false,
  ...over,
});
