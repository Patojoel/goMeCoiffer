import { describe, expect, it } from 'vitest';
import { permissionsOfRole } from '../../domain/services/permissions-of-role.js';

const PROTECTED = ['organization:manage-salons', 'subscription:manage', 'payout-accounts:manage'];

describe('The permissions of a salon role', () => {
  it('gives the real owner of the organization the whole catalogue and the protected rights', () => {
    const owner = permissionsOfRole('OWNER', true);

    expect(owner).toHaveLength(20);
    expect(owner).toEqual(expect.arrayContaining(['bookings:manage', 'roles:administer', ...PROTECTED]));
  });

  it('never gives the protected rights to an Owner role held by someone who does not own the organization', () => {
    const impostor = permissionsOfRole('OWNER', false);

    expect(impostor).toHaveLength(17);
    expect(impostor).toContain('bookings:manage');
    for (const right of PROTECTED) expect(impostor).not.toContain(right);
  });

  it('gives nothing to someone who has no role in the salon', () => {
    expect(permissionsOfRole(null, false)).toEqual([]);
  });
});
