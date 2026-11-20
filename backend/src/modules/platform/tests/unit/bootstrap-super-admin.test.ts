import { beforeEach, describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { BootstrapSuperAdmin } from '../../application/commands/bootstrap-super-admin/bootstrap-super-admin.command.js';
import { BootstrapSuperAdminHandler } from '../../application/commands/bootstrap-super-admin/bootstrap-super-admin.handler.js';
import { SystemRole } from '../../domain/enums/system-role.enum.js';
import { SuperAdminAlreadyExistsError } from '../../domain/exceptions/super-admin-already-exists.error.js';
import { StaffAccountNotFoundError } from '../../domain/exceptions/staff-account-not-found.error.js';
import { StaffAccountRequiredError } from '../../domain/exceptions/staff-account-required.error.js';
import {
  InMemoryAuditTrail,
  InMemoryPlatformAdminRepository,
  InMemoryStaffAccountLookup,
} from '../fakes/platform.fakes.js';

const HENRI_ID = '00000000-0000-7000-8000-000000000001';
const AICHA_ID = '00000000-0000-7000-8000-000000000006';
const NOW = new Date('2026-11-20T09:00:00.000Z');

describe('BootstrapSuperAdminHandler (T8)', () => {
  let repo: InMemoryPlatformAdminRepository;
  let lookup: InMemoryStaffAccountLookup;
  let audit: InMemoryAuditTrail;
  let clock: FixedClock;
  let handler: BootstrapSuperAdminHandler;

  beforeEach(() => {
    repo = new InMemoryPlatformAdminRepository();
    lookup = new InMemoryStaffAccountLookup();
    audit = new InMemoryAuditTrail();
    clock = new FixedClock(NOW);
    handler = new BootstrapSuperAdminHandler(repo, lookup, audit, clock);

    lookup.register(PhoneNumber.parse('6 90 11 22 33'), { userId: HENRI_ID, hasPassword: true });
    lookup.register(PhoneNumber.parse('6 55 44 33 22'), { userId: AICHA_ID, hasPassword: false });
  });

  it('refuses an unknown phone number with StaffAccountNotFoundError', async () => {
    await expect(handler.execute(new BootstrapSuperAdmin('6 70 00 00 01', 'deploy', false))).rejects.toThrow(
      StaffAccountNotFoundError,
    );
    expect(audit.entries).toHaveLength(0);
  });

  it('refuses a light client account without password with StaffAccountRequiredError', async () => {
    await expect(handler.execute(new BootstrapSuperAdmin('6 55 44 33 22', 'deploy', false))).rejects.toThrow(
      StaffAccountRequiredError,
    );
    expect(repo.rolesOf(AICHA_ID)).toHaveLength(0);
    expect(audit.entries).toHaveLength(0);
  });

  it('grants SUPER_ADMIN and writes a SYSTEM_CLI audit entry when not yet assigned', async () => {
    const result = await handler.execute(new BootstrapSuperAdmin('6 90 11 22 33', 'deploy', false));

    expect(result).toEqual({
      userId: HENRI_ID,
      role: SystemRole.SUPER_ADMIN,
      alreadyAssigned: false,
      existingSuperAdmins: 0,
      grantedAt: NOW.toISOString(),
    });
    expect(repo.rolesOf(HENRI_ID)).toEqual([
      { role: SystemRole.SUPER_ADMIN, grantedAt: NOW, grantedByUserId: null },
    ]);
    expect(audit.entries).toEqual([
      {
        action: 'SYSTEM_ROLE_GRANTED',
        subjectType: 'user',
        subjectId: HENRI_ID,
        actorUserId: null,
        occurredAt: NOW,
        details: { role: SystemRole.SUPER_ADMIN, source: 'SYSTEM_CLI', existingSuperAdmins: 0, systemUser: 'deploy', recovery: false },
      },
    ]);
  });

  it('is idempotent when the user is already SUPER_ADMIN (zero write, zero audit)', async () => {
    const earlier = new Date('2026-11-19T08:00:00.000Z');
    repo.seed(HENRI_ID, SystemRole.SUPER_ADMIN, earlier, null);

    const result = await handler.execute(new BootstrapSuperAdmin('6 90 11 22 33', 'deploy', false));

    expect(result).toEqual({
      userId: HENRI_ID,
      role: SystemRole.SUPER_ADMIN,
      alreadyAssigned: true,
      existingSuperAdmins: 1,
      grantedAt: earlier.toISOString(),
    });
    expect(repo.rolesOf(HENRI_ID)).toHaveLength(1);
    expect(audit.entries).toHaveLength(0);
    expect(repo.dispatchedEvents).toHaveLength(0);
  });

  describe('when a Super Administrator already exists', () => {
    const NADINE_ID = '00000000-0000-7000-8000-000000000002';

    beforeEach(() => {
      lookup.register(PhoneNumber.parse('6 77 12 34 56'), { userId: NADINE_ID, hasPassword: true });
      repo.seed(NADINE_ID, SystemRole.SUPER_ADMIN, NOW, null);
    });

    it('refuses to name another one without the recovery flag, and writes nothing', async () => {
      await expect(handler.execute(new BootstrapSuperAdmin('6 90 11 22 33', 'deploy', false))).rejects.toThrow(
        SuperAdminAlreadyExistsError,
      );

      expect(repo.rolesOf(HENRI_ID)).toHaveLength(0);
      expect(audit.entries).toHaveLength(0);
    });

    it('names another one in recovery mode and records who ran it and how many existed', async () => {
      const result = await handler.execute(new BootstrapSuperAdmin('6 90 11 22 33', 'deploy', true));

      expect(result.alreadyAssigned).toBe(false);
      expect(result.existingSuperAdmins).toBe(1);
      expect(repo.rolesOf(HENRI_ID)).toHaveLength(1);
      expect(audit.entries).toEqual([
        {
          action: 'SYSTEM_ROLE_GRANTED',
          subjectType: 'user',
          subjectId: HENRI_ID,
          actorUserId: null,
          occurredAt: NOW,
          details: {
            role: SystemRole.SUPER_ADMIN,
            source: 'SYSTEM_CLI',
            existingSuperAdmins: 1,
            systemUser: 'deploy',
            recovery: true,
          },
        },
      ]);
    });
  });
});
