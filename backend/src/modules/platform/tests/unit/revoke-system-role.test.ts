import { beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '../../../../test-support/fakes.js';
import { RevokeSystemRole } from '../../application/commands/revoke-system-role/revoke-system-role.command.js';
import { RevokeSystemRoleHandler } from '../../application/commands/revoke-system-role/revoke-system-role.handler.js';
import { SystemRole } from '../../domain/enums/system-role.enum.js';
import { LastSuperAdminError } from '../../domain/exceptions/last-super-admin.error.js';
import { SystemRoleAuthorityLostError } from '../../domain/exceptions/system-role-authority-lost.error.js';
import { SelfSystemRoleModificationError } from '../../domain/exceptions/self-system-role-modification.error.js';
import { SystemRoleNotAssignedError } from '../../domain/exceptions/system-role-not-assigned.error.js';
import {
  InMemoryAuditTrail,
  InMemoryPlatformAdminRepository,
  InMemoryRealtimePublisher,
  InMemoryUserSessionsRevoker,
} from '../fakes/platform.fakes.js';

const HENRI_ID = '00000000-0000-7000-8000-000000000001';
const NADINE_ID = '00000000-0000-7000-8000-000000000002';
const SERGE_ID = '00000000-0000-7000-8000-000000000003';
const NOW = new Date('2026-11-20T09:05:00.000Z');

describe('RevokeSystemRoleHandler (T6, T7)', () => {
  let repo: InMemoryPlatformAdminRepository;
  let sessionsRevoker: InMemoryUserSessionsRevoker;
  let audit: InMemoryAuditTrail;
  let realtime: InMemoryRealtimePublisher;
  let clock: FixedClock;
  let handler: RevokeSystemRoleHandler;

  beforeEach(() => {
    repo = new InMemoryPlatformAdminRepository();
    sessionsRevoker = new InMemoryUserSessionsRevoker();
    audit = new InMemoryAuditTrail();
    realtime = new InMemoryRealtimePublisher();
    clock = new FixedClock(NOW);
    handler = new RevokeSystemRoleHandler(repo, sessionsRevoker, audit, realtime, clock);

    repo.seed(HENRI_ID, SystemRole.SUPER_ADMIN, NOW);
    repo.seed(SERGE_ID, SystemRole.OPERATIONS_ADMIN, NOW, HENRI_ID);
  });

  it('refuses self-revocation with SelfSystemRoleModificationError (T6)', async () => {
    repo.seed(NADINE_ID, SystemRole.SUPER_ADMIN, NOW, HENRI_ID);

    await expect(
      handler.execute(new RevokeSystemRole(HENRI_ID, HENRI_ID, SystemRole.SUPER_ADMIN)),
    ).rejects.toThrow(SelfSystemRoleModificationError);

    expect(sessionsRevoker.revokedUserIds).toHaveLength(0);
    expect(audit.entries).toHaveLength(0);
    expect(realtime.closedUsers).toHaveLength(0);
  });

  it('refuses an author who is no longer Super Administrator, even for a role that is not SUPER_ADMIN (T6)', async () => {
    repo.revokeAll(HENRI_ID, SystemRole.SUPER_ADMIN);

    await expect(
      handler.execute(new RevokeSystemRole(HENRI_ID, SERGE_ID, SystemRole.OPERATIONS_ADMIN)),
    ).rejects.toThrow(SystemRoleAuthorityLostError);

    expect(repo.superAdminLockCount).toBe(1);
    expect(repo.rolesOf(SERGE_ID)).toHaveLength(1);
    expect(sessionsRevoker.revokedUserIds).toHaveLength(0);
    expect(audit.entries).toHaveLength(0);
  });

  it('refuses revoking a role not assigned to the target with SystemRoleNotAssignedError (T6)', async () => {
    await expect(
      handler.execute(new RevokeSystemRole(HENRI_ID, SERGE_ID, SystemRole.FINANCE_ADMIN)),
    ).rejects.toThrow(SystemRoleNotAssignedError);

    // Même si Henri est le seul SUPER_ADMIN, retirer SUPER_ADMIN à Serge (qui ne le possède pas) → 404, pas 409.
    await expect(
      handler.execute(new RevokeSystemRole(HENRI_ID, SERGE_ID, SystemRole.SUPER_ADMIN)),
    ).rejects.toThrow(SystemRoleNotAssignedError);

    expect(sessionsRevoker.revokedUserIds).toHaveLength(0);
    expect(audit.entries).toHaveLength(0);
    expect(realtime.closedUsers).toHaveLength(0);
  });

  it('locks and refuses revoking the last SUPER_ADMIN with LastSuperAdminError (T6)', async () => {
    // Cas défensif : même si un autre acteur tente de retirer le seul SUPER_ADMIN actif.
    await expect(
      handler.execute(new RevokeSystemRole(NADINE_ID, HENRI_ID, SystemRole.SUPER_ADMIN)),
    ).rejects.toThrow(LastSuperAdminError);

    expect(repo.superAdminLockCount).toBe(1);
    expect(repo.rolesOf(HENRI_ID)).toHaveLength(1);
    expect(sessionsRevoker.revokedUserIds).toHaveLength(0);
    expect(audit.entries).toHaveLength(0);
  });

  it('revokes SUPER_ADMIN when at least another SUPER_ADMIN exists (T6)', async () => {
    repo.seed(NADINE_ID, SystemRole.SUPER_ADMIN, NOW, HENRI_ID);

    const result = await handler.execute(
      new RevokeSystemRole(HENRI_ID, NADINE_ID, SystemRole.SUPER_ADMIN),
    );

    expect(repo.superAdminLockCount).toBe(1);
    expect(result).toEqual({
      userId: NADINE_ID,
      role: SystemRole.SUPER_ADMIN,
      revokedAt: NOW.toISOString(),
    });
    expect(repo.rolesOf(NADINE_ID)).toHaveLength(0);
    expect(sessionsRevoker.revokedUserIds).toEqual([NADINE_ID]);
  });

  it('revokes role, revokes all sessions, audits without PII and closes SSE streams (T7)', async () => {
    const result = await handler.execute(
      new RevokeSystemRole(HENRI_ID, SERGE_ID, SystemRole.OPERATIONS_ADMIN),
    );

    expect(repo.superAdminLockCount).toBe(1);
    expect(result).toEqual({
      userId: SERGE_ID,
      role: SystemRole.OPERATIONS_ADMIN,
      revokedAt: NOW.toISOString(),
    });
    expect(repo.rolesOf(SERGE_ID)).toHaveLength(0);
    expect(sessionsRevoker.revokedUserIds).toEqual([SERGE_ID]);
    expect(realtime.closedUsers).toEqual([SERGE_ID]);
    expect(audit.entries).toEqual([
      {
        action: 'SYSTEM_ROLE_REVOKED',
        subjectType: 'user',
        subjectId: SERGE_ID,
        actorUserId: HENRI_ID,
        occurredAt: NOW,
        details: { role: SystemRole.OPERATIONS_ADMIN },
      },
    ]);
    expect(repo.dispatchedEvents).toHaveLength(1);
  });

  it('keeps the revocation successful even if realtime stream closing fails synchronously (T7)', async () => {
    realtime.failOnClose = true;

    const result = await handler.execute(
      new RevokeSystemRole(HENRI_ID, SERGE_ID, SystemRole.OPERATIONS_ADMIN),
    );

    expect(result.userId).toBe(SERGE_ID);
    expect(repo.rolesOf(SERGE_ID)).toHaveLength(0);
    expect(sessionsRevoker.revokedUserIds).toEqual([SERGE_ID]);
    expect(audit.entries).toHaveLength(1);
  });
});
