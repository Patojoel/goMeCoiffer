import { OrganizationCreatedSchema } from '@gomecoiffer/contracts';
import { Controller, Get } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CLOCK } from '../../../../shared/application/ports.js';
import {
  RequiresPermission,
  RequiresSystemRole,
} from '../../../../shared/infrastructure/security/decorators.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { sessionCookieOf, StaffAccounts } from '../builders/staff-accounts.js';

@Controller('salon/probe-organizations')
class SalonProbeController {
  @Get('planning')
  @RequiresPermission('bookings:manage')
  planning() {
    return { ok: true };
  }
}

@Controller('admin/probe-organizations')
class AdminProbeController {
  @Get('platform')
  @RequiresSystemRole('SUPER_ADMIN')
  platform() {
    return { ok: true };
  }
}

const SALON = {
  name: 'Go Beauty Akwa',
  type: 'MIXED',
  city: 'Douala',
  district: 'Akwa',
  landmark: 'Rue Joffre, face à la pharmacie du Centre',
  phone: '6 99 88 77 66',
};
const CREATE = '/api/salon/organizations';
const SIGNED_IN_AT = new Date('2026-11-19T09:00:00+01:00');
const WEEK_MS = 7 * 86_400_000;
const sidOf = sessionCookieOf;

describe('A signed-in user creates their organization and first salon', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let accounts: StaffAccounts;

  beforeAll(async () => {
    clock = new FixedClock(SIGNED_IN_AT);
    t = await startTestApp({
      controllers: [SalonProbeController, AdminProbeController],
      overrides: [[CLOCK, clock]],
    });
    db = t.moduleRef.get(getDataSourceToken());
    accounts = new StaffAccounts(db);
  });
  afterAll(() => t.close());
  beforeEach(() => clock.set(SIGNED_IN_AT));

  const count = async (table: string, userId: string, column = 'owner_user_id') =>
    Number((await db.query(`SELECT count(*) AS n FROM ${table} WHERE ${column} = $1`, [userId]))[0].n);
  const nothingCreatedFor = async (userId: string) => {
    expect(await count('organizations', userId)).toBe(0);
    expect(await count('salon_memberships', userId, 'user_id')).toBe(0);
  };
  const createdBy = async (browser: Browser, over: object = {}) =>
    browser.post(CREATE, { ...SALON, ...over });
  /** Un collaborateur d'un salon qu'il ne possède pas (rôle sans permission définie avant UC-008). */
  const makeCollaboratorOf = async (salonId: string, userId: string) =>
    db.query(
      `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
       VALUES (gen_random_uuid(), $1, $2, 'HAIRDRESSER', 'ACTIVE', now(), 1)`,
      [salonId, userId],
    );

  it('creates the organization, the unpublished salon on Douala time and the owner membership in one go', async () => {
    const browser = t.browser();
    const { account } = await accounts.signedIn(browser, 'Mireille Ndongo');

    const res = await createdBy(browser);

    expect(res.status).toBe(201);
    const created = OrganizationCreatedSchema.parse(res.body.data);
    expect(created.session).toEqual({
      user: { id: account.id, name: 'Mireille Ndongo' },
      activeSalonId: created.salonId,
      salons: [
        { id: created.salonId, name: 'Go Beauty Akwa', role: 'OWNER', city: 'Douala', district: 'Akwa' },
      ],
      systemRoles: [],
      nextStep: 'OPEN_SALON',
    });
    const [org] = await db.query(`SELECT id, name FROM organizations WHERE owner_user_id = $1`, [account.id]);
    expect(org).toEqual({ id: created.organizationId, name: 'Go Beauty Akwa' });
    const [salon] = await db.query(
      `SELECT organization_id, name, type, city, district, landmark, phone, timezone, publication_status FROM salons WHERE id = $1`,
      [created.salonId],
    );
    expect(salon).toEqual({
      organization_id: created.organizationId,
      name: 'Go Beauty Akwa',
      type: 'MIXED',
      city: 'Douala',
      district: 'Akwa',
      landmark: 'Rue Joffre, face à la pharmacie du Centre',
      phone: '+237699887766',
      timezone: 'Africa/Douala',
      publication_status: 'NOT_PUBLISHED',
    });
    const [membership] = await db.query(
      `SELECT role, status FROM salon_memberships WHERE salon_id = $1 AND user_id = $2`,
      [created.salonId, account.id],
    );
    expect(membership).toEqual({ role: 'OWNER', status: 'ACTIVE' });
  });

  it('opens the new salon in the session without a new sign-in and keeps it for the next requests', async () => {
    const browser = t.browser();
    await accounts.signedIn(browser, 'Mireille Ndongo');
    const created = (await createdBy(browser)).body.data;
    browser.useCsrfToken(created.csrfToken);

    const summary = await browser.get('/api/salon/session');

    expect(summary.status).toBe(200);
    expect(summary.body.data.activeSalonId).toBe(created.salonId);
    expect(summary.body.data.salons).toEqual([
      { id: created.salonId, name: 'Go Beauty Akwa', role: 'OWNER', city: 'Douala', district: 'Akwa' },
    ]);
  });

  it('gives the owner the permissions of the salon from the next request, and none before', async () => {
    const browser = t.browser();
    await accounts.signedIn(browser, 'Mireille Ndongo');
    const before = await browser.get('/api/salon/probe-organizations/planning');
    const created = (await createdBy(browser)).body.data;
    browser.useCsrfToken(created.csrfToken);

    const after = await browser.get('/api/salon/probe-organizations/planning');

    expect(before.status).toBe(403);
    expect(before.body.message).toBe('Choisissez d’abord le salon sur lequel vous travaillez.');
    expect(after.status).toBe(200);
  });

  it('gives the owner no right in the GoMeCoiffer administration', async () => {
    const browser = t.browser();
    await accounts.signedIn(browser, 'Mireille Ndongo');
    const created = (await createdBy(browser)).body.data;
    browser.useCsrfToken(created.csrfToken);

    const res = await browser.get('/api/admin/probe-organizations/platform');

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Action réservée à l’équipe GoMeCoiffer.');
    expect(created.session.systemRoles).toEqual([]);
  });

  it('forgets a salon the user has left: the permissions are read again on every request', async () => {
    const browser = t.browser();
    const { account } = await accounts.signedIn(browser, 'Mireille Ndongo');
    const created = (await createdBy(browser)).body.data;
    browser.useCsrfToken(created.csrfToken);
    await db.query(`UPDATE salon_memberships SET status = 'REVOKED' WHERE user_id = $1`, [account.id]);

    const res = await browser.get('/api/salon/probe-organizations/planning');

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Choisissez d’abord le salon sur lequel vous travaillez.');
  });

  describe('a second organization', () => {
    it('is refused and leaves the first salon as it was', async () => {
      const browser = t.browser();
      const { account } = await accounts.signedIn(browser, 'Mireille Ndongo');
      const first = (await createdBy(browser)).body.data;
      browser.useCsrfToken(first.csrfToken);

      const second = await createdBy(browser, { name: 'Go Beauty Bastos' });

      expect(second.status).toBe(409);
      expect(second.body.code).toBe('ORGANIZATION_ALREADY_EXISTS');
      expect(second.body.message).toBe('Vous avez déjà une organisation. Ouvrez votre salon pour continuer.');
      expect(await count('organizations', account.id)).toBe(1);
      const salons = await db.query(`SELECT name FROM salons WHERE organization_id = $1`, [
        first.organizationId,
      ]);
      expect(salons).toEqual([{ name: 'Go Beauty Akwa' }]);
    });
  });

  describe('the request body', () => {
    it.each([
      ['ownerUserId', '0195f000-0000-7000-8000-00000000b002'],
      ['organizationId', '0195f000-0000-7000-8000-00000000b003'],
      ['publicationStatus', 'PUBLISHED'],
      ['timezone', 'Europe/Paris'],
      ['systemRole', 'SUPER_ADMIN'],
    ])('refuses the whole request when it also carries %s', async (key, value) => {
      const browser = t.browser();
      const { account } = await accounts.signedIn(browser, 'Mireille Ndongo');

      const res = await createdBy(browser, { [key]: value });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      await nothingCreatedFor(account.id);
    });

    it.each([
      ['name', 'G'],
      ['type', 'institut de manucure'],
      ['city', 'Paris'],
      ['district', 'A'],
      ['landmark', 'Rue'],
      ['phone', '+33 6 12 34 56 78'],
    ])('refuses an invalid %s and says which field', async (field, value) => {
      const browser = t.browser();
      const { account } = await accounts.signedIn(browser, 'Mireille Ndongo');

      const res = await createdBy(browser, { [field]: value });

      expect(res.status).toBe(400);
      expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual([field]);
      await nothingCreatedFor(account.id);
    });
  });

  describe('who may call it', () => {
    it('refuses a request without session', async () => {
      const res = await createdBy(t.browser());

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Session absente ou expirée : reconnectez-vous.');
    });

    it('refuses a request without CSRF token and creates nothing', async () => {
      const browser = t.browser();
      const { account } = await accounts.signedIn(browser, 'Mireille Ndongo');

      const res = await browser.agent.post(CREATE).send(SALON);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CSRF_INVALID');
      await nothingCreatedFor(account.id);
    });
  });

  describe('the session of the new owner', () => {
    it('gets a new identifier and a new CSRF token, and the old ones stop working', async () => {
      const browser = t.browser();
      const { csrfToken: oldToken, sid: oldSid } = await accounts.signedIn(browser, 'Mireille Ndongo');

      const res = await createdBy(browser);

      expect(res.status).toBe(201);
      expect(res.body.data.csrfToken).not.toBe(oldToken);
      expect(sidOf(res)).toBeDefined();
      expect(sidOf(res)).not.toBe(oldSid);
      const withOldCookie = await request(t.app.getHttpServer())
        .get('/api/salon/session')
        .set('Cookie', oldSid ?? '');
      expect(withOldCookie.status).toBe(401);
      const withOldToken = await browser.agent.post(CREATE).set('x-csrf-token', oldToken).send(SALON);
      expect(withOldToken.status).toBe(403);
      browser.useCsrfToken(res.body.data.csrfToken);
      expect((await createdBy(browser)).status).toBe(409);
    });

    it('keeps the sign-in instant: the session still ends 7 days after the sign-in', async () => {
      const browser = t.browser();
      await accounts.signedIn(browser, 'Mireille Ndongo');
      clock.advanceMinutes(60);
      const created = (await createdBy(browser)).body.data;
      browser.useCsrfToken(created.csrfToken);

      clock.set(new Date(SIGNED_IN_AT.getTime() + WEEK_MS - 1_000));
      const justBefore = await browser.get('/api/salon/session');
      clock.set(new Date(SIGNED_IN_AT.getTime() + WEEK_MS + 1_000));
      const justAfter = await browser.get('/api/salon/session');

      expect(justBefore.status).toBe(200);
      expect(justAfter.status).toBe(401);
    });

    it('keeps the version of the credentials: an account reset once stays signed in after the creation', async () => {
      const browser = t.browser();
      const account = await accounts.create('Mireille Ndongo');
      await db.query(`UPDATE users SET credentials_version = 2 WHERE id = $1`, [account.id]);
      await accounts.signIn(browser, account);
      const created = (await createdBy(browser)).body.data;
      browser.useCsrfToken(created.csrfToken);

      const res = await browser.get('/api/salon/session');

      expect(res.status).toBe(200);
    });

    it('is still closed by a later change of credentials', async () => {
      const browser = t.browser();
      const { account } = await accounts.signedIn(browser, 'Mireille Ndongo');
      const created = (await createdBy(browser)).body.data;
      browser.useCsrfToken(created.csrfToken);
      await db.query(`UPDATE users SET credentials_version = credentials_version + 1 WHERE id = $1`, [
        account.id,
      ]);

      const res = await browser.get('/api/salon/session');

      expect(res.status).toBe(401);
    });

    it('is left untouched by a refused creation', async () => {
      const browser = t.browser();
      const { csrfToken, sid: oldSid } = await accounts.signedIn(browser, 'Mireille Ndongo');
      const refused = await createdBy(browser, { name: 'G' });
      const summary = await browser.get('/api/salon/session');

      expect(refused.status).toBe(400);
      expect(sidOf(refused) ?? oldSid).toBe(oldSid);
      expect(summary.status).toBe(200);
      expect(summary.body.data.activeSalonId).toBeNull();
      expect((await createdBy(browser)).status).toBe(201);
      expect(csrfToken).toBeTruthy();
    });
  });

  describe('what the other users of the platform see', () => {
    it('keeps the salon of a collaborator invisible to the owner of the salon where they work', async () => {
      const clarisse = t.browser();
      const paul = t.browser();
      const { account: clarisseAccount } = await accounts.signedIn(clarisse, 'Clarisse Fotso');
      const elegance = (await createdBy(clarisse, { name: 'Élégance Bonamoussadi' })).body.data;
      clarisse.useCsrfToken(elegance.csrfToken);
      const { account: paulAccount } = await accounts.signedIn(paul, 'Paul Ebode');
      await makeCollaboratorOf(elegance.salonId, paulAccount.id);

      const res = await paul.post(CREATE, {
        ...SALON,
        name: 'Paul Barber Deïdo',
        type: 'BARBER_SHOP',
        district: 'Deïdo',
      });
      paul.useCsrfToken(res.body.data.csrfToken);

      expect(res.status).toBe(201);
      expect(res.body.data.session.salons.map((s: { name: string }) => s.name).sort()).toEqual([
        'Paul Barber Deïdo',
        'Élégance Bonamoussadi',
      ]);
      expect(
        res.body.data.session.salons.find((s: { name: string }) => s.name === 'Élégance Bonamoussadi').role,
      ).toBe('HAIRDRESSER');
      const clarisseSummary = await clarisse.get('/api/salon/session');
      expect(clarisseSummary.body.data.salons).toEqual([
        {
          id: elegance.salonId,
          name: 'Élégance Bonamoussadi',
          role: 'OWNER',
          city: 'Douala',
          district: 'Akwa',
        },
      ]);
      expect(await count('salon_memberships', clarisseAccount.id, 'user_id')).toBe(1);
    });

    it('leads each user to the right next step at the next sign-in', async () => {
      const mireille = await accounts.create('Mireille Ndongo');
      const mireilleBrowser = t.browser();
      await accounts.signIn(mireilleBrowser, mireille);
      await createdBy(mireilleBrowser);
      const clarisse = t.browser();
      const clarisseAccount = await accounts.create('Clarisse Fotso');
      await accounts.signIn(clarisse, clarisseAccount);
      const elegance = (await createdBy(clarisse, { name: 'Élégance Bonamoussadi' })).body.data;
      const paulAccount = await accounts.create('Paul Ebode');
      const paulBrowser = t.browser();
      await accounts.signIn(paulBrowser, paulAccount);
      await makeCollaboratorOf(elegance.salonId, paulAccount.id);
      await paulBrowser.post(CREATE, { ...SALON, name: 'Paul Barber Deïdo' });

      const mireilleAgain = await accounts.signIn(t.browser(), mireille);
      const paulAgain = await accounts.signIn(t.browser(), paulAccount);

      expect(mireilleAgain.body.data.session.nextStep).toBe('OPEN_SALON');
      expect(paulAgain.body.data.session.nextStep).toBe('CHOOSE_SALON');
    });
  });

  it('traces the creation and the ownership without any personal data', async () => {
    const browser = t.browser();
    const { account } = await accounts.signedIn(browser, 'Mireille Ndongo');
    const created = (await createdBy(browser)).body.data;

    const rows = await db.query(
      `SELECT action, subject_type, actor_user_id, salon_id, details FROM audit_log
       WHERE salon_id = $1 AND action IN ('ORGANIZATION_FOUNDED', 'SALON_MEMBERSHIP_GRANTED') ORDER BY action DESC`,
      [created.salonId],
    );

    expect(rows).toEqual([
      {
        action: 'SALON_MEMBERSHIP_GRANTED',
        subject_type: 'salon_membership',
        actor_user_id: account.id,
        salon_id: created.salonId,
        details: { role: 'OWNER' },
      },
      {
        action: 'ORGANIZATION_FOUNDED',
        subject_type: 'organization',
        actor_user_id: account.id,
        salon_id: created.salonId,
        details: { type: 'MIXED' },
      },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/699887766|Joffre|\+237/);
  });
});
