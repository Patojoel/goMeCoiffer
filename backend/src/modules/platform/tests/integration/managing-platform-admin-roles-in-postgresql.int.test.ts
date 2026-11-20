import { randomUUID } from 'node:crypto';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { platformSeeder } from '../../../../database/seed/platform.seed.js';
import {
  ACTOR_RIGHTS,
  type ActorRights,
  AUDIT_TRAIL,
  type AuditTrail,
  CLOCK,
} from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { RevokeSystemRole } from '../../application/commands/revoke-system-role/revoke-system-role.command.js';
import { PlatformAdmin } from '../../domain/aggregates/platform-admin.js';
import { SystemRole } from '../../domain/enums/system-role.enum.js';
import { LastSuperAdminError } from '../../domain/exceptions/last-super-admin.error.js';
import { StaffAccountRequiredError } from '../../domain/exceptions/staff-account-required.error.js';
import { SuperAdminAlreadyExistsError } from '../../domain/exceptions/super-admin-already-exists.error.js';
import { SystemRoleAlreadyGrantedError } from '../../domain/exceptions/system-role-already-granted.error.js';
import {
  PLATFORM_ADMIN_REPOSITORY,
  type PlatformAdminRepository,
} from '../../domain/repositories/write/platform-admin.repository.js';
import {
  extractPhoneFromArgs,
  hasRecoveryFlag,
  runBootstrapSuperAdmin,
} from '../../infrastructure/cli/bootstrap-super-admin.cli.js';

const NOW = new Date('2026-11-20T09:00:00.000Z');
const OPERATOR = { systemUser: 'deploy', recovery: false };

describe('Platform admin roles in PostgreSQL (T9–T12, T23)', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let commands: TransactionalCommandBus;
  let repo: PlatformAdminRepository;
  let actorRights: ActorRights;
  let auditTrail: AuditTrail;
  let failNextAudit = false;

  const createUser = async (input: {
    phone: string;
    name: string | null;
    hasPassword?: boolean;
  }): Promise<string> => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, holder_since, terms_accepted_at, created_at, version)
       VALUES ($1, $2, $3, $4, now(), now(), now(), now(), 1)`,
      [id, input.phone, input.name, input.hasPassword === false ? null : 'argon2-hash'],
    );
    return id;
  };

  const assignRole = async (userId: string, role: SystemRole, grantedBy: string | null = null) => {
    await db.query(
      `INSERT INTO platform_admin_roles (user_id, role, granted_at, granted_by_user_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, role, NOW, grantedBy],
    );
  };

  beforeAll(async () => {
    clock = new FixedClock(NOW);
    t = await startTestApp({ overrides: [[CLOCK, clock]] });
    db = t.moduleRef.get(getDataSourceToken());
    commands = t.moduleRef.get(TransactionalCommandBus);
    repo = t.moduleRef.get<PlatformAdminRepository>(PLATFORM_ADMIN_REPOSITORY);
    actorRights = t.moduleRef.get<ActorRights>(ACTOR_RIGHTS);
    auditTrail = t.moduleRef.get<AuditTrail>(AUDIT_TRAIL);

    const originalRecord = auditTrail.record.bind(auditTrail);
    auditTrail.record = async (entry) => {
      if (failNextAudit) {
        failNextAudit = false;
        throw new Error('simulated audit write failure');
      }
      return originalRecord(entry);
    };
  });

  afterAll(() => t?.close());

  beforeEach(async () => {
    failNextAudit = false;
    clock.set(NOW);
    await db.query(`DELETE FROM platform_admin_roles`);
    await db.query(`DELETE FROM audit_log`);
    await db.query(`DELETE FROM sessions`);
    await db.query(`DELETE FROM salon_memberships`);
    await db.query(`DELETE FROM salons`);
    await db.query(`DELETE FROM organizations`);
    await db.query(`DELETE FROM users`);
  });

  it('translates duplicate (user_id, role) insert (23505) into SystemRoleAlreadyGrantedError (T9)', async () => {
    const sergeId = await createUser({ phone: '+237692334455', name: 'Serge Kamga' });
    await assignRole(sergeId, SystemRole.OPERATIONS_ADMIN);

    const staleAdmin = PlatformAdmin.restore({ userId: sergeId, roles: [] });
    staleAdmin.grantRole({ role: SystemRole.OPERATIONS_ADMIN, actorUserId: null, now: NOW });

    await expect(repo.save(staleAdmin)).rejects.toThrow(SystemRoleAlreadyGrantedError);
  });

  it('serializes two concurrent cross-revocations of the last two SUPER_ADMINs and preserves exactly one (T10)', async () => {
    const henriId = await createUser({ phone: '+237690112233', name: 'Henri Ondoa' });
    const nadineId = await createUser({ phone: '+237691223344', name: 'Nadine Tchatchouang' });
    await assignRole(henriId, SystemRole.SUPER_ADMIN);
    await assignRole(nadineId, SystemRole.SUPER_ADMIN);

    const [first, second] = await Promise.allSettled([
      commands.execute(new RevokeSystemRole(henriId, nadineId, SystemRole.SUPER_ADMIN)),
      commands.execute(new RevokeSystemRole(nadineId, henriId, SystemRole.SUPER_ADMIN)),
    ]);

    const fulfilled = [first, second].filter((r) => r.status === 'fulfilled');
    const rejected = [first, second].filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toBeInstanceOf(LastSuperAdminError);

    const remaining: Array<{ user_id: string }> = await db.query(
      `SELECT user_id FROM platform_admin_roles WHERE role = 'SUPER_ADMIN'`,
    );
    expect(remaining).toHaveLength(1);
  });

  it('rolls back role deletion, credentials_version increment and session deletion when a failure occurs in the transaction (T11)', async () => {
    const henriId = await createUser({ phone: '+237690112233', name: 'Henri Ondoa' });
    const sergeId = await createUser({ phone: '+237692334455', name: 'Serge Kamga' });
    await assignRole(henriId, SystemRole.SUPER_ADMIN);
    await assignRole(sergeId, SystemRole.OPERATIONS_ADMIN, henriId);
    await db.query(
      `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2::json, now() + interval '1 day')`,
      ['sid-serge-rollback', JSON.stringify({ userId: sergeId, credentialsVersion: 1 })],
    );

    failNextAudit = true;
    await expect(
      commands.execute(new RevokeSystemRole(henriId, sergeId, SystemRole.OPERATIONS_ADMIN)),
    ).rejects.toThrow('simulated audit write failure');

    const roles = await db.query(`SELECT role FROM platform_admin_roles WHERE user_id = $1`, [sergeId]);
    expect(roles).toEqual([{ role: SystemRole.OPERATIONS_ADMIN }]);

    const [user] = await db.query(`SELECT credentials_version FROM users WHERE id = $1`, [sergeId]);
    expect(user.credentials_version).toBe(1);

    const sessions = await db.query(`SELECT sid FROM sessions WHERE sid = $1`, ['sid-serge-rollback']);
    expect(sessions).toHaveLength(1);

    const audits = await db.query(`SELECT id FROM audit_log WHERE subject_id = $1`, [sergeId]);
    expect(audits).toHaveLength(0);
  });

  it('resolves real systemRoles in SqlActorRights while preserving credentialsVersion and strict salon isolation (T12)', async () => {
    const henriId = await createUser({ phone: '+237690112233', name: 'Henri Ondoa' });
    const sergeId = await createUser({ phone: '+237692334455', name: 'Serge Kamga' });
    const mireilleId = await createUser({ phone: '+237677123456', name: 'Mireille Ndongo' });
    await assignRole(henriId, SystemRole.SUPER_ADMIN);
    await assignRole(sergeId, SystemRole.OPERATIONS_ADMIN, henriId);

    const akwaOrgId = randomUUID();
    const akwaId = randomUUID();
    await db.query(
      `INSERT INTO organizations (id, owner_user_id, name, created_at, version) VALUES ($1, $2, 'Go Beauty', now(), 1)`,
      [akwaOrgId, mireilleId],
    );
    await db.query(
      `INSERT INTO salons (id, organization_id, name, type, city, district, landmark, phone, created_at, version)
       VALUES ($1, $2, 'Go Beauty Akwa', 'MIXED', 'Douala', 'Akwa', 'Rue Joffre', '+237699887766', now(), 1)`,
      [akwaId, akwaOrgId],
    );
    await db.query(
      `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', now(), 1)`,
      [randomUUID(), akwaId, mireilleId],
    );

    const henriInAkwa = await actorRights.resolve(henriId, akwaId);
    expect(henriInAkwa.systemRoles).toEqual([SystemRole.SUPER_ADMIN]);
    expect(henriInAkwa.isMember).toBe(false);
    expect(henriInAkwa.permissions).toEqual([]);
    expect(henriInAkwa.credentialsVersion).toBe(1);

    const sergePlatform = await actorRights.resolve(sergeId, null);
    expect(sergePlatform.systemRoles).toEqual([SystemRole.OPERATIONS_ADMIN]);
    expect(sergePlatform.isMember).toBe(false);

    const mireilleInAkwa = await actorRights.resolve(mireilleId, akwaId);
    expect(mireilleInAkwa.systemRoles).toEqual([]);
    expect(mireilleInAkwa.isMember).toBe(true);
    expect(mireilleInAkwa.permissions.length).toBeGreaterThan(0);
  });

  it('bootstraps the first SUPER_ADMIN via CLI entrypoint idempotently, rejects light clients, and seeds demo admins idempotently (T23)', async () => {
    expect(extractPhoneFromArgs(['--phone=6 90 11 22 33'])).toBe('6 90 11 22 33');
    expect(extractPhoneFromArgs(['--phone', '+237690112233'])).toBe('+237690112233');
    expect(() => extractPhoneFromArgs([])).toThrow(/--phone/);
    expect(hasRecoveryFlag(['--phone=6 90 11 22 33'])).toBe(false);
    expect(hasRecoveryFlag(['--phone=6 90 11 22 33', '--recovery'])).toBe(true);

    const henriId = await createUser({ phone: '+237690112233', name: 'Henri Ondoa' });
    await createUser({ phone: '+237655443322', name: null, hasPassword: false });

    const first = await runBootstrapSuperAdmin(commands, '6 90 11 22 33', OPERATOR);
    expect(first).toEqual({
      userId: henriId,
      role: SystemRole.SUPER_ADMIN,
      alreadyAssigned: false,
      existingSuperAdmins: 0,
      grantedAt: NOW.toISOString(),
    });

    const second = await runBootstrapSuperAdmin(commands, '+237690112233', OPERATOR);
    expect(second.alreadyAssigned).toBe(true);

    const audits: Array<{ action: string; actor_user_id: string | null; details: unknown }> = await db.query(
      `SELECT action, actor_user_id, details FROM audit_log WHERE subject_id = $1`,
      [henriId],
    );
    expect(audits).toHaveLength(1);
    expect(audits[0]).toEqual({
      action: 'SYSTEM_ROLE_GRANTED',
      actor_user_id: null,
      details: {
        role: 'SUPER_ADMIN',
        source: 'SYSTEM_CLI',
        existingSuperAdmins: 0,
        systemUser: 'deploy',
        recovery: false,
      },
    });

    await expect(runBootstrapSuperAdmin(commands, '6 55 44 33 22', OPERATOR)).rejects.toThrow(
      StaffAccountRequiredError,
    );

    const nadineId = await createUser({ phone: '+237677123456', name: 'Nadine Biya' });
    await expect(runBootstrapSuperAdmin(commands, '6 77 12 34 56', OPERATOR)).rejects.toThrow(
      SuperAdminAlreadyExistsError,
    );
    const recovered = await runBootstrapSuperAdmin(commands, '6 77 12 34 56', { ...OPERATOR, recovery: true });
    expect(recovered).toMatchObject({ userId: nadineId, alreadyAssigned: false, existingSuperAdmins: 1 });
    await db.query(`DELETE FROM platform_admin_roles WHERE user_id = $1`, [nadineId]);

    await platformSeeder.run(db);
    await platformSeeder.run(db);
    const seededRoles: Array<{ phone: string; role: string }> = await db.query(
      `SELECT u.phone, r.role
       FROM platform_admin_roles r
       JOIN users u ON u.id = r.user_id
       ORDER BY u.phone, r.role`,
    );
    expect(seededRoles).toEqual([
      { phone: '+237690112233', role: 'SUPER_ADMIN' },
      { phone: '+237692334455', role: 'OPERATIONS_ADMIN' },
    ]);
  });
});

