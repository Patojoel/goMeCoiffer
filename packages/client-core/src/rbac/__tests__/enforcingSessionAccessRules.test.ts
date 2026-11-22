import { describe, expect, it } from 'vitest';
import { can, canAccessSalonSpace, hasSystemRole, resolveHomeTarget } from '../can.js';
import {
  activeSalonChanged,
  clientSessionStateFrom,
  selectExpiredSessionKind,
  selectHasPermission,
  selectHasSystemRole,
  selectIsAuthenticated,
  sessionCleared,
  sessionExpired,
  sessionSlice,
  sessionStarted,
  sessionStateFromSummary,
  type SessionState,
} from '../sessionSlice.js';

const unauthenticated: SessionState = {
  userId: null,
  kind: null,
  activeSalonId: null,
  permissions: [],
  systemRoles: [],
  maskedPhone: null,
};

const clientSession: SessionState = {
  userId: 'u-client',
  kind: 'CLIENT',
  activeSalonId: null,
  permissions: ['bookings:manage'],
  systemRoles: ['SUPER_ADMIN'],
  maskedPhone: '6 55 •• •• 22',
};

const staffSession: SessionState = {
  userId: 'u-staff',
  kind: 'STAFF',
  activeSalonId: 'salon-1',
  permissions: ['staff:invite', 'bookings:manage'],
  systemRoles: ['OPERATIONS_ADMIN'],
  maskedPhone: null,
};

describe('Session RBAC and space isolation', () => {
  it('refuses salon back-office access when unauthenticated or holding a CLIENT session', () => {
    expect(canAccessSalonSpace(unauthenticated)).toBe(false);
    expect(canAccessSalonSpace(clientSession)).toBe(false);
    expect(can(clientSession, 'bookings:manage')).toBe(false);
    expect(hasSystemRole(clientSession, 'SUPER_ADMIN')).toBe(false);
  });

  it('grants salon access, salon permissions and system roles to authenticated STAFF sessions', () => {
    expect(canAccessSalonSpace(staffSession)).toBe(true);
    expect(can(staffSession, 'staff:invite')).toBe(true);
    expect(can(staffSession, 'finances:view')).toBe(false);
    expect(hasSystemRole(staffSession, 'OPERATIONS_ADMIN')).toBe(true);
    expect(hasSystemRole(staffSession, 'SUPER_ADMIN')).toBe(false);
  });

  it.each([
    ['PLATFORM_ADMIN', 'admin'],
    ['OPEN_SALON', 'salon-home'],
    ['CHOOSE_SALON', 'choose-salon'],
    ['CREATE_ORGANIZATION', 'create-organization'],
  ] as const)('maps NextStep %s to home target %s', (nextStep, expected) => {
    expect(resolveHomeTarget(nextStep)).toBe(expected);
  });

  it('ignores activeSalonChanged and denies selectors for CLIENT or incomplete sessions', () => {
    const nextClient = sessionSlice.reducer(
      clientSession,
      activeSalonChanged({ salonId: 's-hijack', permissions: ['roles:administer'] }),
    );
    const brokenStaff: SessionState = { ...staffSession, userId: null };

    expect(nextClient.activeSalonId).toBeNull();
    expect(nextClient.permissions).toEqual(['bookings:manage']);
    expect(selectIsAuthenticated({ session: brokenStaff })).toBe(false);
    expect(selectHasPermission({ session: brokenStaff }, 'staff:invite')).toBe(false);
    expect(selectHasSystemRole({ session: brokenStaff }, 'OPERATIONS_ADMIN')).toBe(false);
  });

  it('tracks expiredKind on sessionExpired and resets it on sessionStarted, sessionCleared and factories (RG-013-17)', () => {
    const expiredStaff = sessionSlice.reducer(staffSession, sessionExpired());
    expect(expiredStaff.userId).toBeNull();
    expect(expiredStaff.kind).toBeNull();
    expect(expiredStaff.activeSalonId).toBeNull();
    expect(expiredStaff.permissions).toEqual([]);
    expect(selectExpiredSessionKind({ session: expiredStaff })).toBe('STAFF');

    const expiredClient = sessionSlice.reducer(clientSession, sessionExpired());
    expect(expiredClient.userId).toBeNull();
    expect(expiredClient.maskedPhone).toBeNull();
    expect(selectExpiredSessionKind({ session: expiredClient })).toBe('CLIENT');

    const expiredAnonymous = sessionSlice.reducer(unauthenticated, sessionExpired());
    expect(selectExpiredSessionKind({ session: expiredAnonymous })).toBeNull();

    const repeatedExpiredStaff = sessionSlice.reducer(expiredStaff, sessionExpired());
    expect(selectExpiredSessionKind({ session: repeatedExpiredStaff })).toBe('STAFF');

    const clearedAfterExpired = sessionSlice.reducer(expiredStaff, sessionCleared());
    expect(selectExpiredSessionKind({ session: clearedAfterExpired })).toBeNull();

    const restartedAfterExpired = sessionSlice.reducer(
      expiredStaff,
      sessionStarted({ ...staffSession, expiredKind: 'CLIENT' }),
    );
    expect(selectExpiredSessionKind({ session: restartedAfterExpired })).toBeNull();

    expect(
      sessionStateFromSummary({
        user: { id: 'u1', name: 'Mireille' },
        activeSalonId: 's1',
        salons: [],
        permissions: [],
        systemRoles: [],
        nextStep: 'OPEN_SALON',
      }).expiredKind,
    ).toBeNull();
    expect(clientSessionStateFrom('6 55 •• •• 22').expiredKind).toBeNull();
  });
});
