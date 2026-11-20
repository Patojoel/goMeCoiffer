import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ADJUSTABLE_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  SalonAddedSchema,
  SalonRolesSchema,
} from '@gomecoiffer/contracts';
import { getStorageToken, type ThrottlerStorageService } from '@nestjs/throttler';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AUDIT_TRAIL, type AuditTrail, CLOCK } from '../../../../shared/application/ports.js';
import { SseRealtimePublisher } from '../../../../shared/infrastructure/realtime/sse-realtime.publisher.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SMS_SENDER } from '../../../identity/domain/ports/sms-sender.port.js';
import { InMemorySmsSender } from '../../../identity/tests/fakes/identity-fakes.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { sessionCookieOf, type StaffAccount, StaffAccounts } from '../builders/staff-accounts.js';

const ADD_SALON = '/api/salon/salons';
const SESSION = '/api/salon/session';
const SELECT_SALON = '/api/salon/session/active-salon';
const ROLES = '/api/salon/roles';
const SIGNED_IN_AT = new Date('2026-11-20T09:00:00+01:00');
const WEEK_MS = 7 * 86_400_000;

const BASTOS_BODY = {
  name: 'Go Beauty Bastos',
  type: 'MIXED',
  city: 'Yaoundé',
  district: 'Bastos',
  landmark: "Avenue Jean-Paul II, face à l'ambassade de Chine",
  phone: '6 91 22 33 44',
};

const codeIn = (sms: string | undefined) => sms?.match(/\b(\d{6})\b/)?.[1] ?? '';
const eventually = async (check: () => boolean, timeoutMs = 2_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
};

describe('Adding a salon to an existing organization (UC-010)', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let sms: InMemorySmsSender;
  let accounts: StaffAccounts;
  let world: SalonWorld;
  let publisher: SseRealtimePublisher;
  let throttlerStorage: ThrottlerStorageService;
  let port: number;

  let mireille: StaffAccount;
  let akwa: WorldSalon;

  beforeAll(async () => {
    clock = new FixedClock(SIGNED_IN_AT);
    sms = new InMemorySmsSender();
    t = await startTestApp({
      overrides: [
        [CLOCK, clock],
        [SMS_SENDER, sms],
      ],
    });
    db = t.moduleRef.get(getDataSourceToken());
    accounts = new StaffAccounts(db);
    world = new SalonWorld(db);
    publisher = t.moduleRef.get(SseRealtimePublisher);
    throttlerStorage = t.moduleRef.get(getStorageToken());
    await t.app.listen(0);
    port = (t.app.getHttpServer().address() as AddressInfo).port;
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    clock.set(SIGNED_IN_AT);
    sms.sent.length = 0;
    throttlerStorage.storage.clear();
    (throttlerStorage as unknown as { hitExpirations: Map<string, unknown> }).hitExpirations.clear();

    mireille = await accounts.create('Mireille Ndongo');
    [akwa] = (await world.organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
    ])) as [WorldSalon];
  });

  const signInToSalon = async (account: StaffAccount, salonId: string) => {
    const browser = t.browser();
    await accounts.signIn(browser, account);
    const selected = await browser.post(SELECT_SALON, { salonId });
    expect(selected.status).toBe(200);
    browser.useCsrfToken(selected.body.data.csrfToken);
    return { browser, csrfToken: selected.body.data.csrfToken as string, sid: sessionCookieOf(selected)! };
  };

  const addSalon = (browser: Browser, over: object = {}) =>
    browser.post(ADD_SALON, { ...BASTOS_BODY, ...over });

  const salonsOfOwner = async (ownerId: string): Promise<Array<{ id: string; name: string }>> =>
    db.query(
      `SELECT s.id, s.name FROM salons s JOIN organizations o ON o.id = s.organization_id
       WHERE o.owner_user_id = $1 ORDER BY s.name`,
      [ownerId],
    );

  const openStream = (cookie: string) =>
    new Promise<{ text: () => string; ended: () => boolean; hangUp: () => void }>((resolve, reject) => {
      let ended = false;
      let text = '';
      const req = http
        .get({ host: '127.0.0.1', port, path: '/api/salon/realtime/stream', headers: { cookie } }, (res) => {
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => (text += chunk));
          res.on('end', () => (ended = true));
          res.on('close', () => (ended = true));
          resolve({ text: () => text, ended: () => ended, hangUp: () => req.destroy() });
        })
        .on('error', reject);
    });

  // T9 — Parcours nominal
  it('T9: adds a second salon, opens it in session, keeps org name and initializes the 4 default roles', async () => {
    await db.query(
      `UPDATE salon_role_permissions
       SET permissions = array_append(permissions, 'finances:view'), version = version + 1
       WHERE salon_id = $1 AND role = 'SALON_ADMIN'`,
      [akwa.id],
    );
    const { browser } = await signInToSalon(mireille, akwa.id);

    const res = await addSalon(browser);

    expect(res.status).toBe(201);
    const added = SalonAddedSchema.parse(res.body.data);
    browser.useCsrfToken(added.csrfToken);

    expect(added.session.activeSalonId).toBe(added.salonId);
    expect(added.session.salons).toEqual([
      { id: akwa.id, name: 'Go Beauty Akwa', role: 'OWNER', city: 'Douala', district: 'Akwa' },
      { id: added.salonId, name: 'Go Beauty Bastos', role: 'OWNER', city: 'Yaoundé', district: 'Bastos' },
    ]);

    const [org] = await db.query(`SELECT name FROM organizations WHERE id = $1`, [added.organizationId]);
    expect(org.name).toBe('Go Beauty Akwa');

    const [salonRow] = await db.query(
      `SELECT timezone, publication_status FROM salons WHERE id = $1`,
      [added.salonId],
    );
    expect(salonRow).toEqual({ timezone: 'Africa/Douala', publication_status: 'NOT_PUBLISHED' });

    const summary = await browser.get(SESSION);
    expect(summary.status).toBe(200);
    expect(summary.body.data.activeSalonId).toBe(added.salonId);

    const rolesRes = await browser.get(ROLES);
    expect(rolesRes.status).toBe(200);
    const roles = SalonRolesSchema.parse(rolesRes.body.data);
    const adminRole = roles.roles.find((r) => r.role === 'SALON_ADMIN');
    expect(adminRole?.permissions).toEqual([...DEFAULT_ROLE_PERMISSIONS.SALON_ADMIN]);
    expect(adminRole?.permissions).not.toContain('finances:view');
  });

  // T10 — Reprise à la connexion suivante
  it('T10: prompts to choose a salon at the next sign-in once the owner has two salons', async () => {
    const { browser } = await signInToSalon(mireille, akwa.id);
    expect((await addSalon(browser)).status).toBe(201);

    const nextSignIn = await accounts.signIn(t.browser(), mireille);

    expect(nextSignIn.status).toBe(200);
    expect(nextSignIn.body.data.session.nextStep).toBe('CHOOSE_SALON');
    expect(nextSignIn.body.data.session.activeSalonId).toBeNull();
    expect(nextSignIn.body.data.session.salons.map((s: { name: string }) => s.name)).toEqual([
      'Go Beauty Akwa',
      'Go Beauty Bastos',
    ]);
  });

  // T11 — Doublon de nom, concurrence et autre organisation
  describe('T11 — salon name uniqueness', () => {
    it('refuses duplicate salon names (exact, lower-case, extra spaces) with 409 and leaves active salon unchanged', async () => {
      const { browser } = await signInToSalon(mireille, akwa.id);

      for (const duplicateName of ['Go Beauty Akwa', 'go beauty akwa', '  Go   Beauty  Akwa  ']) {
        const res = await addSalon(browser, { name: duplicateName });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('SALON_NAME_ALREADY_EXISTS');
      }
      expect(await salonsOfOwner(mireille.id)).toHaveLength(1);
      expect((await browser.get(SESSION)).body.data.activeSalonId).toBe(akwa.id);
    });

    it('lets only one of two parallel requests for the same name succeed (201 + 409)', async () => {
      const { browser } = await signInToSalon(mireille, akwa.id);

      const results = await Promise.all([addSalon(browser), addSalon(browser)]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const bastosSalons = (await salonsOfOwner(mireille.id)).filter((s) => s.name === 'Go Beauty Bastos');
      expect(bastosSalons).toHaveLength(1);
    });

    it('allows another organization to add a salon with the same name', async () => {
      const clarisse = await accounts.create('Clarisse Fotso');
      const [elegance] = (await world.organizationOf(clarisse.id, [
        { name: 'Élégance Bonamoussadi', city: 'Douala', district: 'Bonamoussadi' },
      ])) as [WorldSalon];
      const mireilleSession = await signInToSalon(mireille, akwa.id);
      expect((await addSalon(mireilleSession.browser)).status).toBe(201);

      const clarisseSession = await signInToSalon(clarisse, elegance.id);
      const clarisseRes = await addSalon(clarisseSession.browser);

      expect(clarisseRes.status).toBe(201);
      expect(clarisseRes.body.data.session.salons.map((s: { name: string }) => s.name)).toEqual([
        'Élégance Bonamoussadi',
        'Go Beauty Bastos',
      ]);
    });
  });

  // T12 — Table de droits (403 FORBIDDEN)
  describe('T12 — only the real owner of the active salon organization may add a salon', () => {
    it.each([
      ['Rodrigue (SALON_ADMIN with all 16 adjustable permissions)', 'SALON_ADMIN', false],
      ['Awa (HAIRDRESSER)', 'HAIRDRESSER', false],
      ['Hortense (FINANCE_MANAGER)', 'FINANCE_MANAGER', false],
      ['Paul (HAIRDRESSER in Élégance despite owning Paul Barber)', 'HAIRDRESSER', true],
    ])('refuses %s with 403 FORBIDDEN and creates nothing', async (_label, role, ownsAnotherOrg) => {
      const collaborator = await accounts.create('Collaborator');
      if (ownsAnotherOrg) {
        await world.organizationOf(collaborator.id, [
          { name: 'Paul Barber Deïdo', city: 'Douala', district: 'Deïdo' },
        ]);
      }
      await world.membership(akwa.id, collaborator.id, role);
      if (role === 'SALON_ADMIN') {
        await db.query(
          `UPDATE salon_role_permissions SET permissions = $1 WHERE salon_id = $2 AND role = 'SALON_ADMIN'`,
          [[...ADJUSTABLE_PERMISSIONS], akwa.id],
        );
      }
      const { browser } = await signInToSalon(collaborator, akwa.id);

      const res = await addSalon(browser);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(await salonsOfOwner(mireille.id)).toHaveLength(1);
    });
  });

  // T13 — Isolation de l'équipe d'Akwa
  it('T13: keeps the new salon invisible and inaccessible (404) to collaborators of Akwa', async () => {
    const rodrigue = await accounts.create('Rodrigue Etoa');
    const awa = await accounts.create('Awa Tchoua');
    const hortense = await accounts.create('Hortense Mballa');
    await world.membership(akwa.id, rodrigue.id, 'SALON_ADMIN');
    await world.membership(akwa.id, awa.id, 'HAIRDRESSER');
    await world.membership(akwa.id, hortense.id, 'FINANCE_MANAGER');

    const { browser: mireilleBrowser } = await signInToSalon(mireille, akwa.id);
    const addedRes = await addSalon(mireilleBrowser);
    expect(addedRes.status).toBe(201);
    const added = addedRes.body.data;

    for (const collaborator of [rodrigue, awa, hortense]) {
      const { browser } = await signInToSalon(collaborator, akwa.id);
      const sessionRes = await browser.get(SESSION);
      expect(sessionRes.body.data.salons.map((s: { id: string }) => s.id)).not.toContain(added.salonId);

      const openRes = await browser.post(SELECT_SALON, { salonId: added.salonId });
      expect(openRes.status).toBe(404);
    }
  });

  // T14 — Protections d'accès (401, CLIENT 403, CSRF 403, sans salon actif 403)
  describe('T14 — access guards', () => {
    it('refuses a request without session (401)', async () => {
      const res = await addSalon(t.browser());

      expect(res.status).toBe(401);
      expect(await salonsOfOwner(mireille.id)).toHaveLength(1);
    });

    it('refuses a CLIENT SMS session even for an owner (403 STAFF_SIGN_IN_REQUIRED)', async () => {
      const browser = t.browser();
      await browser.post('/api/public/client/code', { phone: mireille.typed, termsAccepted: true });
      await eventually(() => sms.sent.length > 0);
      const code = codeIn(sms.lastTo(mireille.e164));
      const clientSignIn = await browser.post('/api/public/client/session', {
        phone: mireille.typed,
        code,
      });
      expect(clientSignIn.status).toBe(200);
      browser.useCsrfToken(clientSignIn.body.data.csrfToken);

      const res = await addSalon(browser);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('STAFF_SIGN_IN_REQUIRED');
      expect(await salonsOfOwner(mireille.id)).toHaveLength(1);
    });

    it('refuses a request without CSRF token (403 CSRF_INVALID)', async () => {
      const { browser } = await signInToSalon(mireille, akwa.id);

      const res = await browser.agent.post(ADD_SALON).send(BASTOS_BODY);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CSRF_INVALID');
      expect(await salonsOfOwner(mireille.id)).toHaveLength(1);
    });

    it('refuses a staff session with no active salon (403)', async () => {
      const browser = t.browser();
      await accounts.signIn(browser, mireille);

      const res = await addSalon(browser);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(res.body.message).toBe('Choisissez d’abord le salon sur lequel vous travaillez.');
    });
  });

  // T15 — Validation et mode strict
  it('T15: refuses invalid fields and forbidden extra keys with 400 and creates nothing', async () => {
    const { browser } = await signInToSalon(mireille, akwa.id);

    const invalidFields: ReadonlyArray<readonly [string, string]> = [
      ['name', 'G'],
      ['type', 'SPA'],
      ['city', 'Paris'],
      ['district', 'A'],
      ['landmark', 'Rue'],
      ['phone', '+33 6 12 34 56 78'],
    ];
    for (const [field, value] of invalidFields) {
      const res = await addSalon(browser, { [field]: value });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual([field]);
    }

    const forbiddenKeys: ReadonlyArray<readonly [string, string]> = [
      ['organizationId', '0195f000-0000-7000-8000-00000000b003'],
      ['ownerUserId', '0195f000-0000-7000-8000-00000000b002'],
      ['publicationStatus', 'PUBLISHED'],
      ['timezone', 'Europe/Paris'],
      ['systemRole', 'SUPER_ADMIN'],
    ];
    for (const [key, value] of forbiddenKeys) {
      const res = await addSalon(browser, { [key]: value });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }

    expect(await salonsOfOwner(mireille.id)).toHaveLength(1);
  });

  // T16 — Régénération de session et SSE
  describe('T16 — session regeneration, lifetime preservation and SSE closure', () => {
    it('rotates session cookie and CSRF token, rejects old ones, keeps 7-day absolute lifetime and closes old SSE only', async () => {
      const phone = await signInToSalon(mireille, akwa.id);
      const tablet = await signInToSalon(mireille, akwa.id);
      const phoneStream = await openStream(phone.sid);
      const tabletStream = await openStream(tablet.sid);

      try {
        clock.advanceMinutes(60);
        const res = await addSalon(phone.browser);
        expect(res.status).toBe(201);
        const newSid = sessionCookieOf(res);
        expect(newSid).toBeDefined();
        expect(newSid).not.toBe(phone.sid);
        expect(res.body.data.csrfToken).not.toBe(phone.csrfToken);

        await eventually(phoneStream.ended);
        publisher.publishToSalon(akwa.id, { type: 'AKWA_PING', payload: {} });
        await eventually(() => tabletStream.text().includes('AKWA_PING'));
        expect(phoneStream.ended()).toBe(true);
        expect(tabletStream.ended()).toBe(false);
        expect(tabletStream.text()).toContain('AKWA_PING');

        const oldCookieRes = await request(t.app.getHttpServer()).get(SESSION).set('Cookie', phone.sid);
        expect(oldCookieRes.status).toBe(401);

        const oldTokenRes = await phone.browser.agent
          .post(ADD_SALON)
          .set('x-csrf-token', phone.csrfToken)
          .send({ ...BASTOS_BODY, name: 'Go Beauty Biyem-Assi' });
        expect(oldTokenRes.status).toBe(403);

        phone.browser.useCsrfToken(res.body.data.csrfToken);
        clock.set(new Date(SIGNED_IN_AT.getTime() + WEEK_MS - 1_000));
        expect((await phone.browser.get(SESSION)).status).toBe(200);
        clock.set(new Date(SIGNED_IN_AT.getTime() + WEEK_MS + 1_000));
        expect((await phone.browser.get(SESSION)).status).toBe(401);
      } finally {
        phoneStream.hangUp();
        tabletStream.hangUp();
      }
    });

    it('still invalidates the regenerated session when credentials_version changes', async () => {
      const { browser } = await signInToSalon(mireille, akwa.id);
      const res = await addSalon(browser);
      expect(res.status).toBe(201);

      await db.query(`UPDATE users SET credentials_version = credentials_version + 1 WHERE id = $1`, [
        mireille.id,
      ]);

      expect((await browser.get(SESSION)).status).toBe(401);
    });
  });

  // T17 — Refus ne régénèrent rien
  it('T17: leaves cookie, CSRF token, active salon and SSE stream intact on 400 and 409', async () => {
    const { browser, sid } = await signInToSalon(mireille, akwa.id);
    const stream = await openStream(sid);

    try {
      const invalid = await addSalon(browser, { name: 'G' });
      const duplicate = await addSalon(browser, { name: 'Go Beauty Akwa' });

      expect(invalid.status).toBe(400);
      expect(duplicate.status).toBe(409);
      expect(sessionCookieOf(invalid) ?? sid).toBe(sid);
      expect(sessionCookieOf(duplicate) ?? sid).toBe(sid);
      expect(stream.ended()).toBe(false);
      expect((await browser.get(SESSION)).body.data.activeSalonId).toBe(akwa.id);
    } finally {
      stream.hangUp();
    }

    expect((await addSalon(browser)).status).toBe(201);
  });

  // T18 — Audit en base sans PII
  it('T18: records SALON_ADDED and SALON_MEMBERSHIP_GRANTED in audit_log without PII', async () => {
    const { browser } = await signInToSalon(mireille, akwa.id);
    const res = await addSalon(browser);
    expect(res.status).toBe(201);
    const added = res.body.data;

    const rows = await db.query(
      `SELECT action, subject_type, actor_user_id, salon_id, details
       FROM audit_log
       WHERE salon_id = $1 AND action IN ('SALON_ADDED', 'SALON_MEMBERSHIP_GRANTED')
       ORDER BY action ASC`,
      [added.salonId],
    );

    expect(rows).toEqual([
      {
        action: 'SALON_ADDED',
        subject_type: 'salon',
        actor_user_id: mireille.id,
        salon_id: added.salonId,
        details: { organizationId: added.organizationId, type: 'MIXED', city: 'Yaoundé' },
      },
      {
        action: 'SALON_MEMBERSHIP_GRANTED',
        subject_type: 'salon_membership',
        actor_user_id: mireille.id,
        salon_id: added.salonId,
        details: { role: 'OWNER' },
      },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/691223344|Jean-Paul|ambassade|\+237/);
  });
});

describe('Adding a salon to an organization under forced server failure (T17)', () => {
  it('rolls back everything and keeps session intact on forced 500', async () => {
    let failAudit = false;
    const flakyAudit: AuditTrail = {
      record: async () => {
        if (failAudit) throw new Error('panne forcée');
      },
    };
    const localApp = await startTestApp({ overrides: [[AUDIT_TRAIL, flakyAudit]] });
    try {
      const localDb = localApp.moduleRef.get<DataSource>(getDataSourceToken());
      const localAccounts = new StaffAccounts(localDb);
      const localWorld = new SalonWorld(localDb);
      const owner = await localAccounts.create('Mireille Ndongo');
      const [localAkwa] = (await localWorld.organizationOf(owner.id, [
        { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
      ])) as [WorldSalon];
      const browser = localApp.browser();
      await localAccounts.signIn(browser, owner);
      const selected = await browser.post(SELECT_SALON, { salonId: localAkwa.id });
      expect(selected.status).toBe(200);
      const oldSid = sessionCookieOf(selected)!;
      browser.useCsrfToken(selected.body.data.csrfToken);

      failAudit = true;
      const failed = await browser.post(ADD_SALON, BASTOS_BODY);

      expect(failed.status).toBe(500);
      expect(sessionCookieOf(failed) ?? oldSid).toBe(oldSid);
      const summary = await browser.get(SESSION);
      expect(summary.status).toBe(200);
      expect(summary.body.data.activeSalonId).toBe(localAkwa.id);

      const [{ n }] = await localDb.query(
        `SELECT count(*)::int AS n FROM salons WHERE name = 'Go Beauty Bastos'`,
      );
      expect(n).toBe(0);
    } finally {
      await localApp.close();
    }
  });
});
