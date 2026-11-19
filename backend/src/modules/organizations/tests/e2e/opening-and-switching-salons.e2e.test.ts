import { ActiveSalonSelectedSchema, SessionSummarySchema } from '@gomecoiffer/contracts';
import { Controller, Get, Post } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ACTOR_RIGHTS, type ActorRights, CLOCK, READ_DB } from '../../../../shared/application/ports.js';
import { RequiresPermission } from '../../../../shared/infrastructure/security/decorators.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SqlActorRights } from '../../application/read-repositories/sql-actor-rights.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { sessionCookieOf, type StaffAccount, StaffAccounts } from '../builders/staff-accounts.js';

@Controller('salon/probe-active-salon')
class SalonProbeController {
  @Get('planning')
  @RequiresPermission('bookings:manage')
  planning() {
    return { ok: true };
  }

  @Post('note')
  @RequiresPermission('bookings:manage')
  note() {
    return { ok: true };
  }
}

/** Droits réels, avec une panne de lecture provoquée sur un salon précis (E5). */
const flakyRights = {
  delegate: undefined as unknown as ActorRights,
  failOn: null as string | null,
  resolve(userId: string, salonId: string | null) {
    if (salonId !== null && salonId === this.failOn) throw new Error('database down');
    return this.delegate.resolve(userId, salonId);
  },
};

const SELECT = '/api/salon/session/active-salon';
const SESSION = '/api/salon/session';
const NOTE = '/api/salon/probe-active-salon/note';
const CONNECTED_AT = new Date('2026-11-19T09:00:00+01:00');
const WEEK_MS = 7 * 86_400_000;
const UNKNOWN_SALON = '0195f000-0000-7000-8000-00000000dead';

describe('A member of the staff opens a salon and switches between salons', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let accounts: StaffAccounts;
  let world: SalonWorld;
  let mireille: StaffAccount;
  let paul: StaffAccount;
  let clarisse: StaffAccount;
  let awa: StaffAccount;
  let akwa: WorldSalon;
  let bastos: WorldSalon;
  let elegance: WorldSalon;
  let deido: WorldSalon;

  beforeAll(async () => {
    clock = new FixedClock(CONNECTED_AT);
    t = await startTestApp({
      controllers: [SalonProbeController],
      overrides: [
        [CLOCK, clock],
        [ACTOR_RIGHTS, flakyRights],
      ],
    });
    db = t.moduleRef.get(getDataSourceToken());
    flakyRights.delegate = new SqlActorRights(t.moduleRef.get(READ_DB));
    accounts = new StaffAccounts(db);
    world = new SalonWorld(db);
  });
  afterAll(() => t.close());

  // Des comptes neufs à chaque test : les salons du contexte sont ceux de UC-005.
  beforeEach(async () => {
    clock.set(CONNECTED_AT);
    flakyRights.failOn = null;
    mireille = await accounts.create('Mireille Ndongo');
    paul = await accounts.create('Paul Ebode');
    clarisse = await accounts.create('Clarisse Fotso');
    awa = await accounts.create('Awa Tchoua');
    [akwa, bastos] = (await world.organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
      { name: 'Go Beauty Bastos', city: 'Yaoundé', district: 'Bastos' },
    ])) as [WorldSalon, WorldSalon];
    [elegance] = (await world.organizationOf(clarisse.id, [
      { name: 'Élégance Bonamoussadi', city: 'Douala', district: 'Bonamoussadi' },
    ])) as [WorldSalon];
    [deido] = (await world.organizationOf(paul.id, [
      { name: 'Paul Barber Deïdo', city: 'Douala', district: 'Deïdo' },
    ])) as [WorldSalon];
    await world.membership(elegance.id, paul.id, 'HAIRDRESSER');
    await world.membership(akwa.id, awa.id, 'HAIRDRESSER');
  });

  const signedIn = async (person: StaffAccount) => {
    const browser = t.browser();
    const res = await accounts.signIn(browser, person);
    return { browser, sid: sessionCookieOf(res)! };
  };
  /** Comme le front : le nouveau jeton remplace l'ancien dès la réponse. */
  const select = async (browser: Browser, salonId: string) => {
    const res = await browser.post(SELECT, { salonId });
    if (res.status === 200) browser.useCsrfToken(res.body.data.csrfToken);
    return res;
  };
  const planning = (browser: Browser) => browser.get('/api/salon/probe-active-salon/planning');
  const summaryOf = async (browser: Browser) => (await browser.get(SESSION)).body.data;
  const withCookie = (sid: string) => request(t.app.getHttpServer()).get(SESSION).set('cookie', sid);
  const auditRows = async () => Number((await db.query(`SELECT count(*) AS n FROM audit_log`))[0].n);

  it('lets a hairdresser open the salon where he works and shows his role there', async () => {
    const { browser } = await signedIn(paul);

    const res = await select(browser, elegance.id);

    expect(res.status).toBe(200);
    const { session } = ActiveSalonSelectedSchema.parse(res.body.data);
    expect(session.activeSalonId).toBe(elegance.id);
    expect(session.salons.find((s) => s.id === elegance.id)?.role).toBe('HAIRDRESSER');
    expect(SessionSummarySchema.parse(await summaryOf(browser)).activeSalonId).toBe(elegance.id);
  });

  it('applies the permissions of the role in the new salon, and none of the previous salon', async () => {
    const { browser } = await signedIn(paul);
    await select(browser, deido.id);
    expect((await planning(browser)).status).toBe(200);

    await select(browser, elegance.id);
    const refused = await planning(browser);

    expect(refused.status).toBe(403);
    expect(refused.body.message).toBe(
      'Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire.',
    );
  });

  it('lets an owner open each salon of her organisation with the permissions of the salon', async () => {
    const { browser } = await signedIn(mireille);

    for (const salon of [akwa, bastos, akwa]) {
      expect((await select(browser, salon.id)).status).toBe(200);
      expect((await summaryOf(browser)).activeSalonId).toBe(salon.id);
      expect((await planning(browser)).status).toBe(200);
    }
  });

  it('lists only the salons of the user, by name, with role, city and district', async () => {
    const { browser } = await signedIn(paul);

    expect((await summaryOf(browser)).salons).toEqual([
      {
        id: elegance.id,
        name: 'Élégance Bonamoussadi',
        role: 'HAIRDRESSER',
        city: 'Douala',
        district: 'Bonamoussadi',
      },
      { id: deido.id, name: 'Paul Barber Deïdo', role: 'OWNER', city: 'Douala', district: 'Deïdo' },
    ]);
  });

  it('does not show to Clarisse the salon of Paul', async () => {
    const { browser } = await signedIn(clarisse);

    const names = (await summaryOf(browser)).salons.map((s: { name: string }) => s.name);

    expect(names).toEqual(['Élégance Bonamoussadi']);
  });

  it('forgets the active salon and the salon of the list once the membership is removed, at the next request', async () => {
    const { browser } = await signedIn(paul);
    await select(browser, elegance.id);
    await world.removeMembership(elegance.id, paul.id);

    const refused = await browser.post(NOTE);
    const summary = await summaryOf(browser);

    expect(refused.status).toBe(403);
    expect(refused.body.message).toBe('Choisissez d’abord le salon sur lequel vous travaillez.');
    expect(summary.activeSalonId).toBeNull();
    expect(summary.salons.map((s: { name: string }) => s.name)).toEqual(['Paul Barber Deïdo']);
  });

  it('lets the only salon of Awa open on request, and asks Mireille to choose again after each sign-in', async () => {
    const awas = await signedIn(awa);
    expect((await summaryOf(awas.browser)).nextStep).toBe('OPEN_SALON');
    expect((await select(awas.browser, akwa.id)).status).toBe(200);

    const first = await signedIn(mireille);
    await select(first.browser, bastos.id);
    const next = await signedIn(mireille);

    const summary = await summaryOf(next.browser);
    expect([summary.nextStep, summary.activeSalonId]).toEqual(['CHOOSE_SALON', null]);
  });

  it('rotates the session: new identifier, new token, the old ones are refused, the old tab cannot write', async () => {
    const { browser } = await signedIn(mireille);
    const inAkwa = await select(browser, akwa.id);
    const sidOfAkwa = sessionCookieOf(inAkwa)!;
    const tokenOfAkwa = inAkwa.body.data.csrfToken as string;

    const inBastos = await select(browser, bastos.id);

    expect(inBastos.status).toBe(200);
    expect(sessionCookieOf(inBastos)).not.toBe(sidOfAkwa);
    expect(inBastos.body.data.csrfToken).not.toBe(tokenOfAkwa);
    expect((await withCookie(sidOfAkwa)).status).toBe(401);
    browser.useCsrfToken(tokenOfAkwa);
    const stale = await browser.post(NOTE);
    expect([stale.status, stale.body.code]).toEqual([403, 'CSRF_INVALID']);
    browser.useCsrfToken(inBastos.body.data.csrfToken);
    expect((await browser.post(NOTE)).status).toBe(201);
  });

  it('does not extend the session: it still ends seven days after the sign-in', async () => {
    const { browser } = await signedIn(mireille);
    clock.set(new Date(CONNECTED_AT.getTime() + WEEK_MS - 60_000));
    await select(browser, bastos.id);

    clock.set(new Date(CONNECTED_AT.getTime() + WEEK_MS + 1_000));

    expect((await browser.get(SESSION)).status).toBe(401);
  });

  it('answers the same when the active salon is reopened, with a new token', async () => {
    const { browser } = await signedIn(paul);
    const first = await select(browser, deido.id);

    const again = await select(browser, deido.id);

    expect(again.status).toBe(200);
    expect(again.body.data.session.activeSalonId).toBe(deido.id);
    expect(again.body.data.csrfToken).not.toBe(first.body.data.csrfToken);
  });

  it('writes nothing to the audit log, whether the change succeeds or is refused', async () => {
    const { browser } = await signedIn(mireille);
    const before = await auditRows();

    await select(browser, bastos.id);
    await select(browser, UNKNOWN_SALON);

    expect(await auditRows()).toBe(before);
  });

  describe('refuses a salon without active membership exactly as a salon that does not exist', () => {
    const cases: Array<
      [string, () => StaffAccount, () => WorldSalon, () => WorldSalon, () => Promise<void>]
    > = [
      ['a salon of another organisation', () => paul, () => deido, () => bastos, async () => {}],
      [
        'a salon of the same organisation without membership',
        () => awa,
        () => akwa,
        () => bastos,
        async () => {},
      ],
      [
        'a salon whose membership was removed',
        () => paul,
        () => deido,
        () => elegance,
        () => world.removeMembership(elegance.id, paul.id),
      ],
    ];

    it.each(cases)('%s: 404, same body, nothing changes', async (_name, who, own, target, prepare) => {
      const { browser } = await signedIn(who());
      const sid = sessionCookieOf(await select(browser, own().id))!;
      await prepare();
      const missing = await select(browser, UNKNOWN_SALON);

      const res = await select(browser, target().id);

      expect([res.status, res.body]).toEqual([404, missing.body]);
      expect(res.body.message).toBe('Ressource introuvable.');
      const same = await withCookie(sid);
      expect([same.status, same.body.data.activeSalonId]).toEqual([200, own().id]);
      expect((await browser.post(NOTE)).body.code).not.toBe('CSRF_INVALID');
    });

    it('refuses an identifier nobody owns, without touching the session', async () => {
      const { browser } = await signedIn(paul);
      const sid = sessionCookieOf(await select(browser, deido.id))!;

      const res = await select(browser, UNKNOWN_SALON);

      expect(res.status).toBe(404);
      expect((await withCookie(sid)).status).toBe(200);
    });
  });

  describe('refuses a request that is not exactly the identifier of a salon', () => {
    const extras = [
      { role: 'OWNER' },
      { userId: '0195f000-0000-7000-8000-00000000b003' },
      { permissions: ['bookings:manage'] },
      { organizationId: '0195f000-0000-7000-8000-00000000b003' },
    ];

    it.each(extras)('an extra field %o: 400, the active salon stays', async (extra) => {
      const { browser } = await signedIn(paul);
      await select(browser, deido.id);

      const res = await browser.post(SELECT, { salonId: elegance.id, ...extra });

      expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_FAILED']);
      expect((await summaryOf(browser)).activeSalonId).toBe(deido.id);
    });

    it('a malformed identifier: 400', async () => {
      const { browser } = await signedIn(paul);

      const res = await browser.post(SELECT, { salonId: 'salon-123' });

      expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_FAILED']);
    });

    it('an empty body: 400', async () => {
      const { browser } = await signedIn(paul);

      expect((await browser.post(SELECT, {})).status).toBe(400);
    });
  });

  describe('refuses a request that is not authenticated or not protected', () => {
    it('without a session: 401', async () => {
      const res = await t.browser().post(SELECT, { salonId: deido.id });

      expect([res.status, res.body.code]).toEqual([401, 'UNAUTHENTICATED']);
    });

    it('without a CSRF token: 403 and the active salon stays', async () => {
      const { browser, sid } = await signedIn(paul);

      const res = await request(t.app.getHttpServer())
        .post(SELECT)
        .set('cookie', sid)
        .send({ salonId: elegance.id });

      expect([res.status, res.body.code]).toEqual([403, 'CSRF_INVALID']);
      expect((await summaryOf(browser)).activeSalonId).toBeNull();
    });
  });

  it('changes nothing when the reading of the membership fails: the old session and token stay valid', async () => {
    const { browser } = await signedIn(paul);
    const sid = sessionCookieOf(await select(browser, deido.id))!;
    flakyRights.failOn = elegance.id;

    const res = await select(browser, elegance.id);
    flakyRights.failOn = null;

    expect(res.status).toBe(500);
    expect((await withCookie(sid)).body.data.activeSalonId).toBe(deido.id);
    expect((await browser.post(NOTE)).status).toBe(201);
  });
});
