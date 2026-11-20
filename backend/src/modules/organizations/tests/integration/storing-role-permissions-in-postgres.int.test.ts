import { randomUUID } from 'node:crypto';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACTOR_RIGHTS, type ActorRights } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { CreateOrganization } from '../../application/commands/create-organization/create-organization.command.js';
import { Organization } from '../../domain/aggregates/organization.js';
import { ADJUSTABLE_SALON_ROLES } from '../../domain/enums/permission.enum.js';
import { RolePermissionsChangedMeanwhileError } from '../../domain/exceptions/role-permissions-changed-meanwhile.error.js';
import {
  SALON_ROLE_PERMISSIONS,
  type SalonRolePermissions,
} from '../../domain/repositories/read/salon-role-permissions.read-repository.js';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../domain/repositories/write/organization.repository.js';
import {
  ROLE_PERMISSIONS_REPOSITORY,
  type RolePermissionsRepository,
} from '../../domain/repositories/write/role-permissions.repository.js';
import { SALON_REPOSITORY, type SalonRepository } from '../../domain/repositories/write/salon.repository.js';
import { defaultPermissionsOf, RolePermissionSet } from '../../domain/value-objects/role-permission-set.js';
import { aSalonDraft, anOwnerCandidate } from '../builders/organization-builders.js';

const NOW = new Date('2026-11-20T09:00:00.000Z');

describe('Storing and reading salon role permissions in PostgreSQL (T13–T15)', () => {
  let t: TestApp;
  let db: DataSource;
  let bus: TransactionalCommandBus;
  let rolePermissions: RolePermissionsRepository;
  let rolePermissionsReader: SalonRolePermissions;
  let organizations: OrganizationRepository;
  let salons: SalonRepository;
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

  const createSalon = async (ownerId: string, name = 'Go Beauty Akwa') => {
    const response = await bus.execute(new CreateOrganization(ownerId, aSalonDraft({ name })));
    return response.salonId;
  };

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
    bus = t.moduleRef.get(TransactionalCommandBus);
    rolePermissions = t.moduleRef.get(ROLE_PERMISSIONS_REPOSITORY);
    rolePermissionsReader = t.moduleRef.get(SALON_ROLE_PERMISSIONS);
    organizations = t.moduleRef.get(ORGANIZATION_REPOSITORY);
    salons = t.moduleRef.get(SALON_REPOSITORY);
    rights = t.moduleRef.get(ACTOR_RIGHTS);
  });
  afterAll(() => t?.close());

  describe('T15 — CreateOrganization initializes default role permissions in the same transaction', () => {
    it('creates the four default role settings when a salon is created through CreateOrganization', async () => {
      const ownerId = await createUser();

      const { salonId } = await bus.execute(new CreateOrganization(ownerId, aSalonDraft({ name: 'Élégance Bonamoussadi' })));

      for (const role of ADJUSTABLE_SALON_ROLES) {
        const setting = await rolePermissions.getOfSalon(salonId, role);
        expect(setting.permissions).toEqual(defaultPermissionsOf(role));
        expect(setting.version).toBe(1);
        expect(await rolePermissionsReader.permissionsOfRoleInSalon(salonId, role)).toEqual(
          defaultPermissionsOf(role),
        );
      }
    });

    it('rolls back both the salon and its role permissions when the transaction fails', async () => {
      const ownerId = await createUser();
      const founded = Organization.found({
        owner: anOwnerCandidate({ userId: ownerId }),
        salon: aSalonDraft({ name: 'Salon Annulé' }),
        ids: { organization: randomUUID(), salon: randomUUID(), membership: randomUUID() },
        now: NOW,
      });

      await expect(
        bus.inTransaction(async () => {
          await organizations.add(founded.organization);
          await salons.add(founded.salon);
          throw new Error('panne forcée après SalonRegistered');
        }),
      ).rejects.toThrow('panne forcée après SalonRegistered');

      const [{ salonsCount, rolesCount }] = await db.query(
        `SELECT (SELECT count(*) FROM salons WHERE id = $1)::int AS "salonsCount",
                (SELECT count(*) FROM salon_role_permissions WHERE salon_id = $1)::int AS "rolesCount"`,
        [founded.salon.snapshot().id],
      );
      expect({ salonsCount, rolesCount }).toEqual({ salonsCount: 0, rolesCount: 0 });
    });
  });

  describe('T13 — Optimistic locking per role in TypeOrmRolePermissionsRepository', () => {
    it('lets only one of two parallel adjustments of the same role succeed and rejects the other with RolePermissionsChangedMeanwhileError', async () => {
      const ownerId = await createUser();
      const salonId = await createSalon(ownerId);

      const first = await rolePermissions.getOfSalon(salonId, 'SALON_ADMIN');
      const second = await rolePermissions.getOfSalon(salonId, 'SALON_ADMIN');

      first.adjustPermissions({
        permissions: RolePermissionSet.create([...defaultPermissionsOf('SALON_ADMIN'), 'finances:view']),
        expectedVersion: 1,
        actorUserId: ownerId,
        now: NOW,
      });
      second.adjustPermissions({
        permissions: RolePermissionSet.create(
          defaultPermissionsOf('SALON_ADMIN').filter((p) => p !== 'staff:invite'),
        ),
        expectedVersion: 1,
        actorUserId: ownerId,
        now: NOW,
      });

      const results = await Promise.allSettled([
        bus.inTransaction(() => rolePermissions.save(first)),
        bus.inTransaction(() => rolePermissions.save(second)),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const [rejected] = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(rejected?.reason).toBeInstanceOf(RolePermissionsChangedMeanwhileError);

      const stored = await rolePermissions.getOfSalon(salonId, 'SALON_ADMIN');
      expect(stored.version).toBe(2);
    });

    it('lets two parallel adjustments of different roles in the same salon both succeed', async () => {
      const ownerId = await createUser();
      const salonId = await createSalon(ownerId, 'Go Beauty Bonapriso');

      const admin = await rolePermissions.getOfSalon(salonId, 'SALON_ADMIN');
      const finance = await rolePermissions.getOfSalon(salonId, 'FINANCE_MANAGER');

      admin.adjustPermissions({
        permissions: RolePermissionSet.create([...defaultPermissionsOf('SALON_ADMIN'), 'finances:view']),
        expectedVersion: 1,
        actorUserId: ownerId,
        now: NOW,
      });
      finance.adjustPermissions({
        permissions: RolePermissionSet.create(['dashboard:view', 'bookings:view-all', 'finances:view']),
        expectedVersion: 1,
        actorUserId: ownerId,
        now: NOW,
      });

      await Promise.all([
        bus.inTransaction(() => rolePermissions.save(admin)),
        bus.inTransaction(() => rolePermissions.save(finance)),
      ]);

      expect((await rolePermissions.getOfSalon(salonId, 'SALON_ADMIN')).version).toBe(2);
      expect((await rolePermissions.getOfSalon(salonId, 'FINANCE_MANAGER')).version).toBe(2);
    });
  });

  describe('T14 — SqlActorRights reads configured permissions per salon and denies by default', () => {
    it('returns configured permissions for the active salon only, keeps owner rights intact, returns credentialsVersion, and denies by default when a setting is missing', async () => {
      const ownerOne = await createUser(4);
      const salonAkwa = await createSalon(ownerOne, 'Go Beauty Akwa');
      const ownerTwo = await createUser(1);
      const salonBastos = await createSalon(ownerTwo, 'Go Beauty Bastos');
      const rodrigue = await createUser(7);

      for (const salonId of [salonAkwa, salonBastos]) {
        await db.query(
          `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
           VALUES ($1, $2, $3, 'SALON_ADMIN', 'ACTIVE', now(), 1)`,
          [randomUUID(), salonId, rodrigue],
        );
      }

      // Ajoute finances:view uniquement dans Akwa.
      const akwaAdmin = await rolePermissions.getOfSalon(salonAkwa, 'SALON_ADMIN');
      akwaAdmin.adjustPermissions({
        permissions: RolePermissionSet.create([...defaultPermissionsOf('SALON_ADMIN'), 'finances:view']),
        expectedVersion: 1,
        actorUserId: ownerOne,
        now: NOW,
      });
      await bus.inTransaction(() => rolePermissions.save(akwaAdmin));

      const inAkwa = await rights.resolve(rodrigue, salonAkwa);
      const inBastos = await rights.resolve(rodrigue, salonBastos);
      const ownerRights = await rights.resolve(ownerOne, salonAkwa);

      expect(inAkwa.isMember).toBe(true);
      expect(inAkwa.permissions).toContain('finances:view');
      expect(inAkwa.credentialsVersion).toBe(7);

      expect(inBastos.isMember).toBe(true);
      expect(inBastos.permissions).not.toContain('finances:view');
      expect(inBastos.permissions).toEqual(defaultPermissionsOf('SALON_ADMIN'));

      expect(ownerRights.permissions).toHaveLength(20);
      expect(ownerRights.credentialsVersion).toBe(4);

      // Refus par défaut : si la ligne de réglage disparaît, le collaborateur n'a aucune permission.
      await db.query(`DELETE FROM salon_role_permissions WHERE salon_id = $1 AND role = 'SALON_ADMIN'`, [
        salonBastos,
      ]);
      const missingSetting = await rights.resolve(rodrigue, salonBastos);
      expect(missingSetting).toMatchObject({
        isMember: true,
        permissions: [],
        credentialsVersion: 7,
      });
    });
  });
});

