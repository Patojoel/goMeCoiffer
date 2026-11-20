import { randomUUID } from 'node:crypto';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUDIT_TRAIL, type AuditTrail } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { AddSalonToOrganization } from '../../application/commands/add-salon-to-organization/add-salon-to-organization.command.js';
import { CreateOrganization } from '../../application/commands/create-organization/create-organization.command.js';
import { Salon } from '../../domain/aggregates/salon.js';
import { ADJUSTABLE_SALON_ROLES } from '../../domain/enums/permission.enum.js';
import { SalonNameAlreadyExistsError } from '../../domain/exceptions/salon-name-already-exists.error.js';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../domain/repositories/write/organization.repository.js';
import { SALON_REPOSITORY, type SalonRepository } from '../../domain/repositories/write/salon.repository.js';
import { defaultPermissionsOf } from '../../domain/value-objects/role-permission-set.js';
import { aSalonDraft } from '../builders/organization-builders.js';

const NOW = new Date('2026-11-20T10:00:00+01:00');
const BASTOS = aSalonDraft({
  name: 'Go Beauty Bastos',
  type: 'MIXED',
  city: 'Yaoundé',
  district: 'Bastos',
  landmark: "Avenue Jean-Paul II, face à l'ambassade de Chine",
  phone: '6 91 22 33 44',
});

describe('Adding a salon to an organization in PostgreSQL', () => {
  let t: TestApp;
  let db: DataSource;
  let bus: TransactionalCommandBus;
  let organizations: OrganizationRepository;
  let salons: SalonRepository;

  const createUser = async () => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, created_at, version, credentials_version)
       VALUES ($1, $2, 'Test', 'argon-hash', now(), 1, 1)`,
      [id, `+2376${String(Math.random()).slice(2, 10)}`],
    );
    return id;
  };

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
    bus = t.moduleRef.get(TransactionalCommandBus);
    organizations = t.moduleRef.get(ORGANIZATION_REPOSITORY);
    salons = t.moduleRef.get(SALON_REPOSITORY);
  });
  afterAll(() => t.close());

  describe('T7 — case-insensitive salon name uniqueness per organization', () => {
    it('translates PostgreSQL 23505 on salons_organization_lower_name_key into SalonNameAlreadyExistsError', async () => {
      const mireille = await createUser();
      const { organizationId } = await bus.execute(
        new CreateOrganization(mireille, aSalonDraft({ name: 'Go Beauty Akwa' })),
      );

      for (const duplicate of ['Go Beauty Akwa', 'go beauty akwa', 'GO BEAUTY AKWA']) {
        const salon = Salon.register({
          id: randomUUID(),
          organizationId,
          details: { ...BASTOS, name: duplicate },
          now: NOW,
        });
        await expect(bus.inTransaction(() => salons.add(salon))).rejects.toThrow(
          SalonNameAlreadyExistsError,
        );
      }

      expect(await salons.existsWithNameInOrganization(organizationId, 'go beauty akwa')).toBe(true);
      expect(await salons.existsWithNameInOrganization(organizationId, 'Go Beauty Bastos')).toBe(false);
    });

    it('allows two different organizations to own a salon with the same name', async () => {
      const mireille = await createUser();
      const clarisse = await createUser();
      await bus.execute(new CreateOrganization(mireille, aSalonDraft({ name: 'Go Beauty Akwa' })));
      const clarisseOrg = await bus.execute(
        new CreateOrganization(clarisse, aSalonDraft({ name: 'Élégance Bonamoussadi' })),
      );

      const mireilleBastos = await bus.execute(new AddSalonToOrganization(mireille, BASTOS));
      const clarisseBastos = await bus.execute(new AddSalonToOrganization(clarisse, BASTOS));

      expect(mireilleBastos.salonId).not.toBe(clarisseBastos.salonId);
      expect(clarisseBastos.organizationId).toBe(clarisseOrg.organizationId);
      expect(await organizations.findByOwner(clarisse)).not.toBeNull();
      expect(await organizations.findByOwner(randomUUID())).toBeNull();
    });
  });

  describe('T8 — WhenSalonRegistered default roles and atomic rollback', () => {
    it('initializes the 4 default roles on the new salon without copying customizations from another salon', async () => {
      const mireille = await createUser();
      const akwa = await bus.execute(
        new CreateOrganization(mireille, aSalonDraft({ name: 'Go Beauty Akwa' })),
      );
      await db.query(
        `UPDATE salon_role_permissions
         SET permissions = array_append(permissions, 'finances:view'), version = version + 1
         WHERE salon_id = $1 AND role = 'SALON_ADMIN'`,
        [akwa.salonId],
      );

      const bastos = await bus.execute(new AddSalonToOrganization(mireille, BASTOS));

      const rows: Array<{ role: string; permissions: string[] }> = await db.query(
        `SELECT role, permissions FROM salon_role_permissions WHERE salon_id = $1 ORDER BY role`,
        [bastos.salonId],
      );
      expect(rows).toHaveLength(ADJUSTABLE_SALON_ROLES.length);
      for (const role of ADJUSTABLE_SALON_ROLES) {
        const row = rows.find((r) => r.role === role);
        expect(row?.permissions).toEqual([...defaultPermissionsOf(role)]);
      }
      expect(rows.find((r) => r.role === 'SALON_ADMIN')?.permissions).not.toContain('finances:view');
    });

    it('rolls back salon, membership, roles and audit when a failure occurs in the transaction', async () => {
      const failingAudit: AuditTrail = {
        record: async () => {
          throw new Error('panne audit simulée');
        },
      };
      const localApp = await startTestApp({ overrides: [[AUDIT_TRAIL, failingAudit]] });
      try {
        const localDb = localApp.moduleRef.get<DataSource>(getDataSourceToken());
        const localBus = localApp.moduleRef.get(TransactionalCommandBus);
        const ownerId = randomUUID();
        const orgId = randomUUID();
        const akwaId = randomUUID();
        await localDb.query(
          `INSERT INTO users (id, phone, name, password_hash, created_at, version, credentials_version)
           VALUES ($1, $2, 'Mireille', 'argon-hash', now(), 1, 1)`,
          [ownerId, `+2376${String(Math.random()).slice(2, 10)}`],
        );
        await localDb.query(
          `INSERT INTO organizations (id, owner_user_id, name, created_at, version) VALUES ($1, $2, 'Go Beauty Akwa', now(), 1)`,
          [orgId, ownerId],
        );
        await localDb.query(
          `INSERT INTO salons (id, organization_id, name, type, city, district, landmark, phone, created_at, version)
           VALUES ($1, $2, 'Go Beauty Akwa', 'MIXED', 'Douala', 'Akwa', 'Rue Joffre', '+237699887766', now(), 1)`,
          [akwaId, orgId],
        );

        await expect(localBus.execute(new AddSalonToOrganization(ownerId, BASTOS))).rejects.toThrow(
          'panne audit simulée',
        );

        const [{ salonsCount }] = await localDb.query(
          `SELECT count(*)::int AS "salonsCount" FROM salons WHERE organization_id = $1 AND name = 'Go Beauty Bastos'`,
          [orgId],
        );
        const [{ membershipsCount }] = await localDb.query(
          `SELECT count(*)::int AS "membershipsCount" FROM salon_memberships WHERE user_id = $1`,
          [ownerId],
        );
        const [{ rolesCount }] = await localDb.query(
          `SELECT count(*)::int AS "rolesCount" FROM salon_role_permissions WHERE salon_id <> $1`,
          [akwaId],
        );
        const [{ auditCount }] = await localDb.query(
          `SELECT count(*)::int AS "auditCount" FROM audit_log WHERE actor_user_id = $1`,
          [ownerId],
        );
        expect([salonsCount, membershipsCount, rolesCount, auditCount]).toEqual([0, 0, 0, 0]);
      } finally {
        await localApp.close();
      }
    });
  });
});

