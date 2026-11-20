import { describe, expect, it } from 'vitest';
import { trackByStaffUser } from '../../infrastructure/http/rate-limit-trackers.js';

describe('Counting the salon additions per owner', () => {
  it('counts per signed-in user, whatever the network address', () => {
    const fromOffice = trackByStaffUser({ session: { userId: 'user-1' }, ip: '41.202.1.1' });
    const fromMobile = trackByStaffUser({ session: { userId: 'user-1' }, ip: '41.202.9.9' });

    expect(fromOffice).toBe('user:user-1');
    expect(fromMobile).toBe(fromOffice);
  });

  it('gives each user its own counter', () => {
    expect(trackByStaffUser({ session: { userId: 'user-2' }, ip: '41.202.1.1' })).not.toBe(
      trackByStaffUser({ session: { userId: 'user-1' }, ip: '41.202.1.1' }),
    );
  });

  it('falls back on the network address when the request carries no user', () => {
    expect(trackByStaffUser({ session: {}, ip: '41.202.1.1' })).toBe('address:41.202.1.1');
    expect(trackByStaffUser({ ip: '41.202.1.1' })).toBe('address:41.202.1.1');
    expect(trackByStaffUser({})).toBe('address:unknown');
  });
});
