import { CITIES as CONTRACT_CITIES } from '@gomecoiffer/contracts';
import { describe, expect, it } from 'vitest';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import { Organization } from '../../domain/aggregates/organization.js';
import { CITIES } from '../../domain/enums/city.enum.js';
import { OrganizationAlreadyExistsError } from '../../domain/exceptions/organization-already-exists.error.js';
import { OwnerAccountRequiredError } from '../../domain/exceptions/owner-account-required.error.js';
import { OrganizationFounded } from '../../domain/events/organization-founded.js';
import { SalonMembership } from '../../domain/aggregates/salon-membership.js';
import { OwnerRoleReservedError } from '../../domain/exceptions/owner-role-reserved.error.js';
import { SalonRegistered } from '../../domain/events/salon-registered.js';
import { aSalonDraft, anOwnerCandidate, MIREILLE_ID } from '../builders/organization-builders.js';

const NOW = new Date('2026-11-19T10:00:00+01:00');
const IDS = { organization: 'org-1', salon: 'salon-1', membership: 'membership-1' };
const found = (draft = aSalonDraft(), owner = anOwnerCandidate()) =>
  Organization.found({ owner, salon: draft, ids: IDS, now: NOW });

describe('Founding an organization with its first salon', () => {
  describe('the commercial name', () => {
    it.each([['G'], ['A'.repeat(61)], ['   ']])('refuses the name %j', (name) => {
      expect(() => found(aSalonDraft({ name }))).toThrow(InvalidValueError);
    });

    it.each([['GB', 'GB'], ['A'.repeat(60), 'A'.repeat(60)], ['  Go   Beauty  Akwa  ', 'Go Beauty Akwa']])(
      'accepts %j and keeps %j',
      (name, kept) => {
        expect(found(aSalonDraft({ name })).salon.snapshot().name).toBe(kept);
      },
    );
  });

  describe('the type of salon', () => {
    it('refuses a type outside the four known ones', () => {
      expect(() => found(aSalonDraft({ type: 'institut de manucure' }))).toThrow(InvalidValueError);
    });

    it.each(['HAIR_SALON', 'BARBER_SHOP', 'BEAUTY', 'MIXED'])('accepts %s', (type) => {
      expect(found(aSalonDraft({ type })).salon.snapshot().type).toBe(type);
    });
  });

  describe('the city and the district', () => {
    it('refuses a city that is not in the closed list', () => {
      expect(() => found(aSalonDraft({ city: 'Paris' }))).toThrow(InvalidValueError);
    });

    it('knows exactly the cities of the contract', () => {
      expect([...CITIES]).toEqual([...CONTRACT_CITIES]);
    });

    it.each(CITIES)('accepts %s', (city) => {
      expect(found(aSalonDraft({ city })).salon.snapshot().city).toBe(city);
    });

    it('refuses a district of one character and accepts one of two', () => {
      expect(() => found(aSalonDraft({ district: 'A' }))).toThrow(InvalidValueError);
      expect(found(aSalonDraft({ district: 'Bé' })).salon.snapshot().district).toBe('Bé');
    });
  });

  describe('the landmark', () => {
    it.each([['x'.repeat(4)], ['x'.repeat(161)]])('refuses %j', (landmark) => {
      expect(() => found(aSalonDraft({ landmark }))).toThrow(InvalidValueError);
    });

    it.each([['x'.repeat(5)], ['x'.repeat(160)]])('accepts %j', (landmark) => {
      expect(found(aSalonDraft({ landmark })).salon.snapshot().landmark).toBe(landmark);
    });
  });

  describe('the business phone', () => {
    it.each([['6 99 88 77 6'], ['+33 6 12 34 56 78']])('refuses %j', (phone) => {
      expect(() => found(aSalonDraft({ phone }))).toThrow(InvalidValueError);
    });

    it.each([
      ['6 77 12 34 56', '+237677123456'],
      ['+237 2 33 42 10 10', '+237233421010'],
    ])('accepts %j and stores %j', (phone, stored) => {
      expect(found(aSalonDraft({ phone })).salon.snapshot().phone).toBe(stored);
    });
  });

  describe('who may found an organization', () => {
    it('refuses a light client account without password', () => {
      expect(() => found(aSalonDraft(), anOwnerCandidate({ hasPassword: false }))).toThrow(
        OwnerAccountRequiredError,
      );
    });

    it('refuses someone who already owns an organization', () => {
      expect(() => found(aSalonDraft(), anOwnerCandidate({ ownsOrganization: true }))).toThrow(
        OrganizationAlreadyExistsError,
      );
    });
  });

  describe('what a successful foundation creates', () => {
    it('names the organization after the salon and makes the founder its owner', () => {
      const { organization } = found();

      expect(organization.snapshot()).toEqual({
        id: 'org-1',
        ownerUserId: MIREILLE_ID,
        name: 'Go Beauty Akwa',
        createdAt: NOW,
        version: 0,
      });
    });

    it('creates an empty salon, not published, on Douala time, attached to the organization', () => {
      const { salon } = found();

      expect(salon.snapshot()).toEqual({
        id: 'salon-1',
        organizationId: 'org-1',
        name: 'Go Beauty Akwa',
        type: 'MIXED',
        city: 'Douala',
        district: 'Akwa',
        landmark: 'Rue Joffre, face à la pharmacie du Centre',
        phone: '+237699887766',
        timezone: 'Africa/Douala',
        publicationStatus: 'NOT_PUBLISHED',
        createdAt: NOW,
        version: 0,
      });
    });

    it('grants the founder an active Owner membership of the salon', () => {
      const { membership } = found();

      expect(membership.snapshot()).toEqual({
        id: 'membership-1',
        salonId: 'salon-1',
        userId: MIREILLE_ID,
        role: 'OWNER',
        status: 'ACTIVE',
        grantedAt: NOW,
        version: 0,
      });
    });

    it('records the facts on the aggregates that own them', () => {
      const { organization, salon } = found();

      expect(organization.pullEvents()).toEqual([new OrganizationFounded('org-1', MIREILLE_ID, NOW)]);
      expect(salon.pullEvents()).toEqual([new SalonRegistered('salon-1', 'org-1', NOW)]);
    });
  });
});

describe('The Owner role of a salon', () => {
  it('cannot be granted to a collaborator: it only comes with the foundation of the organization', () => {
    expect(() =>
      SalonMembership.grantCollaboratorRole({ id: 'm-2', salonId: 'salon-1', userId: 'paul', role: 'OWNER', now: NOW }),
    ).toThrow(OwnerRoleReservedError);
  });

  it('is not needed to give a collaborator an active membership with a predefined role', () => {
    const membership = SalonMembership.grantCollaboratorRole({
      id: 'm-2',
      salonId: 'salon-1',
      userId: 'paul',
      role: 'HAIRDRESSER',
      now: NOW,
    });

    expect(membership.snapshot()).toMatchObject({ role: 'HAIRDRESSER', status: 'ACTIVE', salonId: 'salon-1' });
  });
});
