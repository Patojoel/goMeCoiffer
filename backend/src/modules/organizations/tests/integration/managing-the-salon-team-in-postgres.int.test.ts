import { randomUUID } from 'node:crypto';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACTOR_RIGHTS, type ActorRights } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { CreateOrganization } from '../../application/commands/create-organization/create-organization.command.js';
import { SalonMembership } from '../../domain/aggregates/salon-membership.js';
import { SalonRole } from '../../domain/enums/salon-role.enum.js';
import { TeamMemberChangedMeanwhileError } from '../../domain/exceptions/team-member-changed-meanwhile.error.js';
import {
  SALON_MEMBERSHIP_REPOSITORY,
  type SalonMembershipRepository,
} from '../../domain/repositories/write/salon-membership.repository.js';
import { defaultPermissionsOf } from '../../domain/value-objects/role-permission-set.js';
import { aSalonDraft } from '../builders/organization-builders.js';

const NOW = new Date('2026-11-20T09:00:00.000Z');
const LATER = new Date('2026-11-21T09:00:00.000Z');

describe('Managing salon team memberships in PostgreSQL (T9–T11)', () => {
  let t: TestApp;
  let db: DataSource;
  let bus: TransactionalCommandBus;
  let memberships: Required<SalonMembershipRepository>;
  let rights: ActorRights;

  const createUser = async (credentialsVersion = 1) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, created_at, version, credentials_version)
       VALUES ($1, $2, 'Test', 'argon-hash', now(), 1, $3)`,
      [id, `+2376${String(Math.random()).slice(2, 10)}`, credentialsVersion],
    );
    return id;
  };

  const createSalon = async (ownerId: string, name: string) => {
    const response = await bus.execute(new CreateOrganization(ownerId, aSalonDraft({ name })));
    return response.salonId;
  };

  const addCollaborator = async (salonId: string, userId: string, role: SalonRole) => {
    const id = randomUUID();
    await bus.inTransaction(() =>
      memberships.add(SalonMembership.grantCollaboratorRole({ id, salonId, userId, role, now: NOW })),
    );
    return id;
  };

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
    bus = t.moduleRef.get(TransactionalCommandBus);
    memberships = t.moduleRef.get(SALON_MEMBERSHIP_REPOSITORY);
    rights = t.moduleRef.get(ACTOR_RIGHTS);
  });
  afterAll(() => t?.close());

  describe('T9 — Migration schema and partial index on salon_memberships', () => {
    it('has revoked_at, revoked_by_user_id, reinstated_at columns and the partial active index', async () => {
      const columns = await db.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'salon_memberships'
           AND column_name IN ('revoked_at', 'revoked_by_user_id', 'reinstated_at', 'version')
         ORDER BY column_name`,
      );
      expect(columns.map((c: { column_name: string }) => c.column_name)).toEqual([
        'reinstated_at',
        'revoked_at',
        'revoked_by_user_id',
        'version',
      ]);

      const indexes = await db.query(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE tablename = 'salon_memberships' AND indexname = 'salon_memberships_salon_active_idx'`,
      );
      expect(indexes).toHaveLength(1);
      expect(indexes[0].indexdef).toContain("WHERE (status = 'ACTIVE'::text)");
    });
  });

  describe('T10 — TypeOrmSalonMembershipRepository optimistic locking and salon scoping', () => {
    it('findByIdInSalon never returns a membership belonging to another salon', async () => {
      const ownerA = await createUser();
      const salonA = await createSalon(ownerA, 'Go Beauty Akwa');
      const ownerB = await createUser();
      const salonB = await createSalon(ownerB, 'Élégance Bonamoussadi');
      const paul = await createUser();
      const paulMemId = await addCollaborator(salonB, paul, SalonRole.HAIRDRESSER);

      expect(await memberships.findByIdInSalon(salonA, paulMemId)).toBeNull();
      const found = await memberships.findByIdInSalon(salonB, paulMemId);
      expect(found?.snapshot()).toMatchObject({
        id: paulMemId,
        salonId: salonB,
        userId: paul,
        role: SalonRole.HAIRDRESSER,
        status: 'ACTIVE',
        version: 1,
      });
    });

    it('lets only one of two parallel saves on the same membership succeed and rejects the other with TeamMemberChangedMeanwhileError', async () => {
      const owner = await createUser();
      const salonId = await createSalon(owner, 'Go Beauty Concurrence');
      const awa = await createUser();
      const awaMemId = await addCollaborator(salonId, awa, SalonRole.HAIRDRESSER);

      const first = (await memberships.findByIdInSalon(salonId, awaMemId))!;
      const second = (await memberships.findByIdInSalon(salonId, awaMemId))!;

      first.changeRole({
        newRole: SalonRole.SALON_ADMIN,
        expectedVersion: 1,
        actorUserId: owner,
        now: NOW,
      });
      second.revoke({ expectedVersion: 1, actorUserId: owner, now: NOW });

      const results = await Promise.allSettled([
        bus.inTransaction(() => memberships.save(first)),
        bus.inTransaction(() => memberships.save(second)),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const [rejected] = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected?.reason).toBeInstanceOf(TeamMemberChangedMeanwhileError);

      const stored = (await memberships.findByIdInSalon(salonId, awaMemId))!;
      expect(stored.version).toBe(2);
    });

    it('lets two parallel saves on two different memberships both succeed', async () => {
      const owner = await createUser();
      const salonId = await createSalon(owner, 'Go Beauty Parallel');
      const awa = await createUser();
      const grace = await createUser();
      const awaMemId = await addCollaborator(salonId, awa, SalonRole.HAIRDRESSER);
      const graceMemId = await addCollaborator(salonId, grace, SalonRole.PRACTITIONER);

      const awaMem = (await memberships.findByIdInSalon(salonId, awaMemId))!;
      const graceMem = (await memberships.findByIdInSalon(salonId, graceMemId))!;
      awaMem.changeRole({
        newRole: SalonRole.SALON_ADMIN,
        expectedVersion: 1,
        actorUserId: owner,
        now: NOW,
      });
      graceMem.revoke({ expectedVersion: 1, actorUserId: owner, now: NOW });

      await Promise.all([
        bus.inTransaction(() => memberships.save(awaMem)),
        bus.inTransaction(() => memberships.save(graceMem)),
      ]);

      expect((await memberships.findByIdInSalon(salonId, awaMemId))?.snapshot()).toMatchObject({
        role: SalonRole.SALON_ADMIN,
        version: 2,
      });
      expect((await memberships.findByIdInSalon(salonId, graceMemId))?.snapshot()).toMatchObject({
        status: 'REVOKED',
        revokedAt: NOW,
        revokedByUserId: owner,
        version: 2,
      });
    });
  });

  describe('T11 — SqlActorRights reflects REVOKED and reinstated memberships per salon', () => {
    it('denies access when REVOKED, keeps other salon intact, and restores permissions after reinstate', async () => {
      const ownerA = await createUser();
      const salonAkwa = await createSalon(ownerA, 'Akwa Rights');
      const ownerB = await createUser();
      const salonBastos = await createSalon(ownerB, 'Bastos Rights');
      const rodrigue = await createUser(3);

      const akwaMemId = await addCollaborator(salonAkwa, rodrigue, SalonRole.PRACTITIONER);
      await addCollaborator(salonBastos, rodrigue, SalonRole.SALON_ADMIN);

      // Révocation sur Akwa
      const toRevoke = (await memberships.findByIdInSalon(salonAkwa, akwaMemId))!;
      toRevoke.revoke({ expectedVersion: 1, actorUserId: ownerA, now: NOW });
      await bus.inTransaction(() => memberships.save(toRevoke));

      expect(await rights.resolve(rodrigue, salonAkwa)).toEqual({
        isMember: false,
        permissions: [],
        systemRoles: [],
        credentialsVersion: 3,
      });
      expect(await rights.resolve(rodrigue, salonBastos)).toEqual({
        isMember: true,
        permissions: defaultPermissionsOf('SALON_ADMIN'),
        systemRoles: [],
        credentialsVersion: 3,
      });

      // Réintégration sur Akwa avec un nouveau rôle
      const toReinstate = (await memberships.findBySalonAndUser(salonAkwa, rodrigue))!;
      toReinstate.reinstate({ role: SalonRole.SALON_ADMIN, now: LATER });
      await bus.inTransaction(() => memberships.save(toReinstate));

      expect(await rights.resolve(rodrigue, salonAkwa)).toEqual({
        isMember: true,
        permissions: defaultPermissionsOf('SALON_ADMIN'),
        systemRoles: [],
        credentialsVersion: 3,
      });
    });
  });
});
