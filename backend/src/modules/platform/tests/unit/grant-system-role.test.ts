import { beforeEach, describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { GrantSystemRole } from '../../application/commands/grant-system-role/grant-system-role.command.js';
import { GrantSystemRoleHandler } from '../../application/commands/grant-system-role/grant-system-role.handler.js';
import { SystemRole } from '../../domain/enums/system-role.enum.js';
import { SystemRoleAuthorityLostError } from '../../domain/exceptions/system-role-authority-lost.error.js';
import { SelfSystemRoleModificationError } from '../../domain/exceptions/self-system-role-modification.error.js';
import { StaffAccountNotFoundError } from '../../domain/exceptions/staff-account-not-found.error.js';
import { StaffAccountRequiredError } from '../../domain/exceptions/staff-account-required.error.js';
import { SystemRoleAlreadyGrantedError } from '../../domain/exceptions/system-role-already-granted.error.js';
import {
  InMemoryAuditTrail,
  InMemoryPlatformAdminRepository,
  InMemoryStaffAccountLookup,
} from '../fakes/platform.fakes.js';

const HENRI_ID = '00000000-0000-7000-8000-000000000001';
const BRICE_ID = '00000000-0000-7000-8000-000000000004';
const AICHA_ID = '00000000-0000-7000-8000-000000000006';
const NOW = new Date('2026-11-20T09:00:00.000Z');

describe('GrantSystemRoleHandler (T4, T5)', () => {
  let repo: InMemoryPlatformAdminRepository;
  let lookup: InMemoryStaffAccountLookup;
  let audit: InMemoryAuditTrail;
  let clock: FixedClock;
  let handler: GrantSystemRoleHandler;

  beforeEach(() => {
    repo = new InMemoryPlatformAdminRepository();
    lookup = new InMemoryStaffAccountLookup();
    audit = new InMemoryAuditTrail();
    clock = new FixedClock(NOW);
    handler = new GrantSystemRoleHandler(repo, lookup, audit, clock);

    lookup.register(PhoneNumber.parse('6 90 11 22 33'), { userId: HENRI_ID, hasPassword: true });
    lookup.register(PhoneNumber.parse('6 93 44 55 66'), { userId: BRICE_ID, hasPassword: true });
    lookup.register(PhoneNumber.parse('6 55 44 33 22'), { userId: AICHA_ID, hasPassword: false });
    repo.seed(HENRI_ID, SystemRole.SUPER_ADMIN, NOW);
  });

  it('refuses an unknown phone number with StaffAccountNotFoundError (T4)', async () => {
    await expect(
      handler.execute(new GrantSystemRole(HENRI_ID, '6 70 00 00 01', SystemRole.OPERATIONS_ADMIN)),
    ).rejects.toThrow(StaffAccountNotFoundError);

    expect(audit.entries).toHaveLength(0);
    expect(repo.dispatchedEvents).toHaveLength(0);
  });

  it('refuses a light client account without password with StaffAccountRequiredError (T4)', async () => {
    await expect(
      handler.execute(new GrantSystemRole(HENRI_ID, '6 55 44 33 22', SystemRole.OPERATIONS_ADMIN)),
    ).rejects.toThrow(StaffAccountRequiredError);

    expect(repo.rolesOf(AICHA_ID)).toHaveLength(0);
    expect(audit.entries).toHaveLength(0);
  });

  it('refuses self-assignment even for a secondary role with SelfSystemRoleModificationError (T4)', async () => {
    await expect(
      handler.execute(new GrantSystemRole(HENRI_ID, '6 90 11 22 33', SystemRole.FINANCE_ADMIN)),
    ).rejects.toThrow(SelfSystemRoleModificationError);

    expect(repo.rolesOf(HENRI_ID)).toHaveLength(1);
    expect(audit.entries).toHaveLength(0);
  });

  it('refuses granting an already held role without writing audit (T4)', async () => {
    repo.seed(BRICE_ID, SystemRole.FINANCE_ADMIN, NOW, HENRI_ID);

    await expect(
      handler.execute(new GrantSystemRole(HENRI_ID, '6 93 44 55 66', SystemRole.FINANCE_ADMIN)),
    ).rejects.toThrow(SystemRoleAlreadyGrantedError);

    expect(audit.entries).toHaveLength(0);
  });

  it('grants a system role to a staff account and records a PII-free audit entry (T5)', async () => {
    const result = await handler.execute(
      new GrantSystemRole(HENRI_ID, '6 93 44 55 66', SystemRole.FINANCE_ADMIN),
    );

    expect(result).toEqual({
      userId: BRICE_ID,
      role: SystemRole.FINANCE_ADMIN,
      grantedAt: NOW.toISOString(),
    });
    expect(repo.rolesOf(BRICE_ID)).toEqual([
      { role: SystemRole.FINANCE_ADMIN, grantedAt: NOW, grantedByUserId: HENRI_ID },
    ]);
    expect(audit.entries).toEqual([
      {
        action: 'SYSTEM_ROLE_GRANTED',
        subjectType: 'user',
        subjectId: BRICE_ID,
        actorUserId: HENRI_ID,
        occurredAt: NOW,
        details: { role: SystemRole.FINANCE_ADMIN },
      },
    ]);
    expect(repo.dispatchedEvents).toHaveLength(1);
  });

  it('refuses an author who is no longer Super Administrator once the role changes are serialized (T4)', async () => {
    repo.seed(HENRI_ID, SystemRole.OPERATIONS_ADMIN, NOW);
    repo.revokeAll(HENRI_ID, SystemRole.SUPER_ADMIN);

    await expect(
      handler.execute(new GrantSystemRole(HENRI_ID, '6 93 44 55 66', SystemRole.FINANCE_ADMIN)),
    ).rejects.toThrow(SystemRoleAuthorityLostError);

    expect(repo.superAdminLockCount).toBe(1);
    expect(repo.rolesOf(BRICE_ID)).toHaveLength(0);
    expect(audit.entries).toHaveLength(0);
  });
});
