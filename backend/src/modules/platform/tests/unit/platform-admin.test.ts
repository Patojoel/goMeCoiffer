import { describe, expect, it } from 'vitest';
import { PlatformAdmin } from '../../domain/aggregates/platform-admin.js';
import { SystemRole } from '../../domain/enums/system-role.enum.js';
import { SystemRoleGranted } from '../../domain/events/system-role-granted.js';
import { SystemRoleRevoked } from '../../domain/events/system-role-revoked.js';
import { SystemRoleAlreadyGrantedError } from '../../domain/exceptions/system-role-already-granted.error.js';
import { SystemRoleNotAssignedError } from '../../domain/exceptions/system-role-not-assigned.error.js';

const HENRI_ID = '00000000-0000-7000-8000-000000000001';
const SERGE_ID = '00000000-0000-7000-8000-000000000003';
const NOW = new Date('2026-11-20T09:00:00.000Z');
const LATER = new Date('2026-11-20T09:05:00.000Z');

describe('PlatformAdmin aggregate (T2, T3)', () => {
  describe('grantRole (T2)', () => {
    it('grants a first role and accumulates multiple distinct roles with PII-free SystemRoleGranted events', () => {
      const admin = PlatformAdmin.restore({ userId: SERGE_ID, roles: [] });

      admin.grantRole({ role: SystemRole.OPERATIONS_ADMIN, actorUserId: HENRI_ID, now: NOW });
      admin.grantRole({ role: SystemRole.FINANCE_ADMIN, actorUserId: HENRI_ID, now: LATER });

      expect(admin.hasRole(SystemRole.OPERATIONS_ADMIN)).toBe(true);
      expect(admin.hasRole(SystemRole.FINANCE_ADMIN)).toBe(true);
      expect(admin.hasRole(SystemRole.SUPER_ADMIN)).toBe(false);
      expect(admin.roles).toEqual([
        { role: SystemRole.OPERATIONS_ADMIN, grantedAt: NOW, grantedByUserId: HENRI_ID },
        { role: SystemRole.FINANCE_ADMIN, grantedAt: LATER, grantedByUserId: HENRI_ID },
      ]);

      const events = admin.pullEvents();
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(
        new SystemRoleGranted(SERGE_ID, SystemRole.OPERATIONS_ADMIN, HENRI_ID, NOW),
      );
      expect(events[1]).toEqual(
        new SystemRoleGranted(SERGE_ID, SystemRole.FINANCE_ADMIN, HENRI_ID, LATER),
      );
      expect(Object.keys(events[0]!)).toEqual(['userId', 'role', 'actorUserId', 'occurredAt']);
    });

    it('refuses granting a role the user already holds without recording an event', () => {
      const admin = PlatformAdmin.restore({
        userId: SERGE_ID,
        roles: [{ role: SystemRole.OPERATIONS_ADMIN, grantedAt: NOW, grantedByUserId: HENRI_ID }],
      });

      expect(() =>
        admin.grantRole({ role: SystemRole.OPERATIONS_ADMIN, actorUserId: HENRI_ID, now: LATER }),
      ).toThrow(SystemRoleAlreadyGrantedError);

      expect(admin.roles).toHaveLength(1);
      expect(admin.pullEvents()).toHaveLength(0);
    });
  });

  describe('revokeRole (T3)', () => {
    it('revokes an assigned role while keeping other roles and records a PII-free SystemRoleRevoked event', () => {
      const admin = PlatformAdmin.restore({
        userId: SERGE_ID,
        roles: [
          { role: SystemRole.OPERATIONS_ADMIN, grantedAt: NOW, grantedByUserId: HENRI_ID },
          { role: SystemRole.FINANCE_ADMIN, grantedAt: NOW, grantedByUserId: HENRI_ID },
        ],
      });

      admin.revokeRole({ role: SystemRole.OPERATIONS_ADMIN, actorUserId: HENRI_ID, now: LATER });

      expect(admin.hasRole(SystemRole.OPERATIONS_ADMIN)).toBe(false);
      expect(admin.hasRole(SystemRole.FINANCE_ADMIN)).toBe(true);
      const events = admin.pullEvents();
      expect(events).toEqual([
        new SystemRoleRevoked(SERGE_ID, SystemRole.OPERATIONS_ADMIN, HENRI_ID, LATER),
      ]);
      expect(Object.keys(events[0]!)).toEqual(['userId', 'role', 'actorUserId', 'occurredAt']);
    });

    it('refuses revoking a role the user does not hold without recording an event', () => {
      const admin = PlatformAdmin.restore({
        userId: SERGE_ID,
        roles: [{ role: SystemRole.OPERATIONS_ADMIN, grantedAt: NOW, grantedByUserId: HENRI_ID }],
      });

      expect(() =>
        admin.revokeRole({ role: SystemRole.FINANCE_ADMIN, actorUserId: HENRI_ID, now: LATER }),
      ).toThrow(SystemRoleNotAssignedError);

      expect(admin.roles).toHaveLength(1);
      expect(admin.pullEvents()).toHaveLength(0);
    });
  });
});

