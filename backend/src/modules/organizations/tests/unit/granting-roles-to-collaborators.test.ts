import { describe, expect, it } from 'vitest';
import { RoleAboveInviterError } from '../../domain/exceptions/role-above-inviter.error.js';
import { RoleGrantPolicy } from '../../domain/services/role-grant-policy.js';

const ROLE_PERMISSIONS: Record<string, readonly string[]> = {
  SALON_ADMIN: ['bookings:manage', 'staff:view', 'staff:invite'],
  HAIRDRESSER: ['bookings:view-own', 'availability:edit-own'],
  FINANCE_MANAGER: ['bookings:view-all', 'finances:view', 'finances:record-payment'],
  PRACTITIONER: ['bookings:view-own'],
};
const policy = new RoleGrantPolicy((role) => ROLE_PERMISSIONS[role] ?? []);
const everything = Object.values(ROLE_PERMISSIONS).flat();
const administrator = [
  'bookings:manage',
  'staff:view',
  'staff:invite',
  'bookings:view-own',
  'availability:edit-own',
];

describe('Granting a role to a collaborator without raising rights', () => {
  it.each([['SALON_ADMIN'], ['HAIRDRESSER'], ['FINANCE_MANAGER'], ['PRACTITIONER']] as const)(
    'lets an author who holds every permission invite as %s',
    (role) => {
      expect(() => policy.assertCanGrant(everything, role)).not.toThrow();
    },
  );

  it('refuses a role whose permissions the author does not hold in this salon', () => {
    expect(() => policy.assertCanGrant(administrator, 'FINANCE_MANAGER')).toThrow(RoleAboveInviterError);
  });

  it('accepts a role whose permissions are all held by the author', () => {
    expect(() => policy.assertCanGrant(administrator, 'HAIRDRESSER')).not.toThrow();
  });
});
