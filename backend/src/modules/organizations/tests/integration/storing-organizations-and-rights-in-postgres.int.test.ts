import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACTOR_RIGHTS, type ActorRights } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { NotFoundError } from '../../../../shared/domain/errors.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { CreateOrganization } from '../../application/commands/create-organization/create-organization.command.js';
import { Organization } from '../../domain/aggregates/organization.js';
import { SalonRegistered } from '../../domain/events/salon-registered.js';
import { OrganizationAlreadyExistsError } from '../../domain/exceptions/organization-already-exists.error.js';
import {
  OWNER_CANDIDATES,
  type OwnerCandidates,
} from '../../domain/repositories/read/owner-candidates.read-repository.js';
import {
  ORGANIZATION_REPOSITORY,
  type OrganizationRepository,
} from '../../domain/repositories/write/organization.repository.js';
import {
  SALON_MEMBERSHIP_REPOSITORY,
  type SalonMembershipRepository,
} from '../../domain/repositories/write/salon-membership.repository.js';
import { SALON_REPOSITORY, type SalonRepository } from '../../domain/repositories/write/salon.repository.js';
import { aSalonDraft, anOwnerCandidate } from '../builders/organization-builders.js';

const NOW = new Date('2026-11-19T10:00:00+01:00');
const SALONS_SEEN: string[] = [];

@Injectable()
class WhenSalonRegistered {
  readonly subscribesTo = SalonRegistered;
  handle(event: SalonRegistered) {
    SALONS_SEEN.push(event.salonId);
  }
}

describe('Storing organizations, salons and memberships, and reading the rights of an actor in PostgreSQL', () => {
  let t: TestApp;
  let db: DataSource;
  let bus: TransactionalCommandBus;
  let organizations: OrganizationRepository;
  let salons: SalonRepository;
  let memberships: SalonMembershipRepository;
  let candidates: OwnerCandidates;
  let rights: ActorRights;

  const user = async (password: string | null = 'argon-hash', version = 1) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, created_at, version, credentials_version)
       VALUES ($1, $2, 'Test', $3, now(), 1, $4)`,
      [id, `+2376${String(Math.random()).slice(2, 10)}`, password, version],
    );
    return id;
  };
  const found = (ownerId: string, name = 'Go Beauty Akwa') =>
    Organization.found({
      owner: anOwnerCandidate({ userId: ownerId }),
      salon: aSalonDraft({ name }),
      ids: { organization: randomUUID(), salon: randomUUID(), membership: randomUUID() },
      now: NOW,
    });
  const storeAll = async (f: ReturnType<typeof found>) => {
    await organizations.add(f.organization);
    await salons.add(f.salon);
    await memberships.add(f.membership);
  };

  beforeAll(async () => {
    t = await startTestApp({ providers: [WhenSalonRegistered] });
    db = t.moduleRef.get(getDataSourceToken());
    bus = t.moduleRef.get(TransactionalCommandBus);
    organizations = t.moduleRef.get(ORGANIZATION_REPOSITORY);
    salons = t.moduleRef.get(SALON_REPOSITORY);
    memberships = t.moduleRef.get(SALON_MEMBERSHIP_REPOSITORY);
    candidates = t.moduleRef.get(OWNER_CANDIDATES);
    rights = t.moduleRef.get(ACTOR_RIGHTS);
  });
  afterAll(() => t.close());

  describe('one organization per owner', () => {
    it('translates the unicity violation of the owner into a business error, not a raw SQL error', async () => {
      const owner = await user();
      await bus.inTransaction(() => storeAll(found(owner)));

      await expect(
        bus.inTransaction(() => organizations.add(found(owner, 'Go Beauty Bastos').organization)),
      ).rejects.toThrow(OrganizationAlreadyExistsError);
    });

    it('lets a single one of two simultaneous transactions win', async () => {
      const owner = await user();

      const results = await Promise.allSettled([
        bus.inTransaction(() => storeAll(found(owner))),
        bus.inTransaction(() => storeAll(found(owner, 'Go Beauty Bastos'))),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const [loser] = results.filter((r) => r.status === 'rejected');
      expect((loser as PromiseRejectedResult).reason).toBeInstanceOf(OrganizationAlreadyExistsError);
      const [{ n }] = await db.query(
        `SELECT count(*)::int AS n FROM organizations WHERE owner_user_id = $1`,
        [owner],
      );
      expect(n).toBe(1);
    });
  });

  it('hands the facts recorded by the aggregates to the subscribers of the transaction', async () => {
    const owner = await user();
    const founded = found(owner);

    await bus.inTransaction(() => storeAll(founded));

    expect(SALONS_SEEN).toContain(founded.salon.snapshot().id);
  });

  it('stores the version 1 and the default timezone and publication status of a new salon', async () => {
    const owner = await user();
    const founded = found(owner);
    await bus.inTransaction(() => storeAll(founded));

    const [row] = await db.query(
      `SELECT s.version, s.timezone, s.publication_status AS status, o.version AS org_version, m.version AS membership_version
       FROM salons s JOIN organizations o ON o.id = s.organization_id JOIN salon_memberships m ON m.salon_id = s.id
       WHERE s.id = $1`,
      [founded.salon.snapshot().id],
    );

    expect(row).toEqual({
      version: 1,
      timezone: 'Africa/Douala',
      status: 'NOT_PUBLISHED',
      org_version: 1,
      membership_version: 1,
    });
  });

  describe('the facts the domain needs about an account', () => {
    it('knows a staff account without organization', async () => {
      const owner = await user();

      expect(await candidates.of(owner)).toEqual({
        userId: owner,
        hasPassword: true,
        ownsOrganization: false,
      });
    });

    it('knows a light client account has no password', async () => {
      const light = await user(null);

      expect(await candidates.of(light)).toMatchObject({ hasPassword: false });
    });

    it('knows an owner already has an organization', async () => {
      const owner = await user();
      await bus.inTransaction(() => storeAll(found(owner)));

      expect(await candidates.of(owner)).toMatchObject({ ownsOrganization: true });
    });

    it('does not know an account that does not exist', async () => {
      await expect(candidates.of(randomUUID())).rejects.toThrow(NotFoundError);
    });
  });

  describe('all or nothing', () => {
    it('stores nothing when the command fails while recording the membership', async () => {
      const owner = await user();
      const failing: SalonMembershipRepository = {
        add: async () => {
          throw new Error('panne simulée');
        },
      };
      const founded = found(owner);

      await expect(
        bus.inTransaction(async () => {
          await organizations.add(founded.organization);
          await salons.add(founded.salon);
          await failing.add(founded.membership);
        }),
      ).rejects.toThrow('panne simulée');

      const [{ n }] = await db.query(
        `SELECT (SELECT count(*) FROM organizations WHERE owner_user_id = $1)::int + (SELECT count(*) FROM salons WHERE id = $2)::int AS n`,
        [owner, founded.salon.snapshot().id],
      );
      expect(n).toBe(0);
    });

    it('stores the three rows of a creation done through the command bus', async () => {
      const owner = await user();

      const response = await bus.execute(new CreateOrganization(owner, aSalonDraft()));

      const [row] = await db.query(
        `SELECT m.role, m.status FROM salon_memberships m WHERE m.salon_id = $1 AND m.user_id = $2`,
        [response.salonId, owner],
      );
      expect(row).toEqual({ role: 'OWNER', status: 'ACTIVE' });
    });
  });

  describe('the rights of an actor on the active salon', () => {
    const owner = async () => {
      const id = await user();
      const founded = found(id);
      await bus.inTransaction(() => storeAll(founded));
      return { id, salonId: founded.salon.snapshot().id };
    };
    const collaboratorOf = async (salonId: string) => {
      const id = await user();
      await db.query(
        `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
         VALUES ($1, $2, $3, 'HAIRDRESSER', 'ACTIVE', now(), 1)`,
        [randomUUID(), salonId, id],
      );
      return id;
    };

    it('makes the owner a member with every permission of the catalogue', async () => {
      const { id, salonId } = await owner();

      const resolved = await rights.resolve(id, salonId);

      expect(resolved.isMember).toBe(true);
      expect(resolved.permissions).toHaveLength(20);
      expect(resolved.permissions).toContain('bookings:manage');
      expect(resolved.systemRoles).toEqual([]);
    });

    it('gives the protected rights to the real owner only, not to a hand-written Owner membership', async () => {
      const real = await owner();
      const impostor = await user();
      await db.query(
        `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
         VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', now(), 1)`,
        [randomUUID(), real.salonId, impostor],
      );

      const owned = await rights.resolve(real.id, real.salonId);
      const notOwned = await rights.resolve(impostor, real.salonId);

      expect(owned.permissions).toContain('payout-accounts:manage');
      expect(notOwned.isMember).toBe(true);
      expect(notOwned.permissions).toContain('bookings:manage');
      for (const right of ['payout-accounts:manage', 'subscription:manage', 'organization:manage-salons'])
        expect(notOwned.permissions).not.toContain(right);
    });

    it('gives a user who is not a member of the salon no right on it', async () => {
      const { salonId } = await owner();
      const stranger = await user();

      expect(await rights.resolve(stranger, salonId)).toMatchObject({
        isMember: false,
        permissions: [],
        systemRoles: [],
      });
    });

    it('gives a collaborator whose role has no permission defined yet membership but no permission', async () => {
      const { salonId } = await owner();
      const stylist = await collaboratorOf(salonId);

      expect(await rights.resolve(stylist, salonId)).toMatchObject({ isMember: true, permissions: [] });
    });

    it('gives nothing on a salon that the membership has left', async () => {
      const { id, salonId } = await owner();
      await db.query(`UPDATE salon_memberships SET status = 'REVOKED' WHERE user_id = $1`, [id]);

      expect(await rights.resolve(id, salonId)).toMatchObject({ isMember: false, permissions: [] });
    });

    it('gives nothing when no salon is active', async () => {
      const { id } = await owner();

      expect(await rights.resolve(id, null)).toMatchObject({ isMember: false, permissions: [] });
    });

    it('never gives the rights of one salon on another salon of the same user', async () => {
      const first = await owner();
      const second = await owner();

      expect(await rights.resolve(first.id, second.salonId)).toMatchObject({
        isMember: false,
        permissions: [],
      });
    });

    it('always returns the credentials version of the account, and null for an unknown account', async () => {
      const versioned = await user('argon-hash', 3);

      expect((await rights.resolve(versioned, null)).credentialsVersion).toBe(3);
      expect((await rights.resolve(randomUUID(), null)).credentialsVersion).toBeNull();
    });
  });

  describe('values outside the closed lists', () => {
    const insertSalon = async (type: string, city: string) => {
      const owner = await user();
      const org = randomUUID();
      await db.query(
        `INSERT INTO organizations (id, owner_user_id, name, created_at, version) VALUES ($1, $2, 'X', now(), 1)`,
        [org, owner],
      );
      const salonId = randomUUID();
      await db.query(
        `INSERT INTO salons (id, organization_id, name, type, city, district, landmark, phone, created_at, version)
         VALUES ($1, $2, 'X', $3, $4, 'Akwa', 'repere', '+237699887766', now(), 1)`,
        [salonId, org, type, city],
      );
      return { salonId, owner };
    };

    it('refuses a city outside the twelve of the list', async () => {
      await expect(insertSalon('MIXED', 'Paris')).rejects.toThrow(/salons_city_check/);
    });

    it('refuses a salon type outside the four known ones', async () => {
      await expect(insertSalon('SPA', 'Douala')).rejects.toThrow(/salons_type_check/);
    });

    it('refuses a membership role outside the predefined roles', async () => {
      const { salonId, owner } = await insertSalon('MIXED', 'Douala');

      await expect(
        db.query(
          `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
           VALUES ($1, $2, $3, 'GOD', 'ACTIVE', now(), 1)`,
          [randomUUID(), salonId, owner],
        ),
      ).rejects.toThrow(/salon_memberships_role_check/);
    });
  });
});
