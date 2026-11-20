import { randomUUID } from 'node:crypto';
import { InvitationAcceptedSchema } from '@gomecoiffer/contracts';
import { Controller, Get } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Actor, CLOCK } from '../../../../shared/application/ports.js';
import { AuthenticatedOnly, CurrentActor } from '../../../../shared/infrastructure/security/decorators.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SMS_SENDER } from '../../../identity/domain/ports/sms-sender.port.js';
import { InMemorySmsSender } from '../../../identity/tests/fakes/identity-fakes.js';
import { DAY_MS } from '../builders/invitation-builders.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { type StaffAccount, StaffAccounts } from '../builders/staff-accounts.js';

@Controller('salon/probe-join')
class WhoAmIController {
  @Get('me')
  @AuthenticatedOnly()
  me(@CurrentActor() actor: Actor) {
    return { userId: actor.userId, activeSalonId: actor.activeSalonId };
  }
}

/** Loin dans le futur : le cookie de preuve expire à l'horloge fixe, que la jarre de cookies compare à l'heure réelle. */
const NOW_ON_THE_20TH = new Date('2031-11-20T10:00:00+01:00');
const INVITED_AT = new Date(NOW_ON_THE_20TH.getTime() - DAY_MS);
const PASSWORD = 'Wouri-Barber-2027';
const CODE_PATH = '/api/public/invitations/code';
const PROOF_PATH = '/api/public/invitations/phone-proof';
const acceptancePath = (id: string) => `/api/public/invitations/${id}/acceptance`;
const DETAILS = { name: 'Brice Nana', password: PASSWORD, termsAccepted: true };

const codeIn = (text: string | undefined) => text?.match(/\b(\d{6})\b/)?.[1] ?? '';
const cookieOf = (res: { headers: Record<string, unknown> }, name: string) =>
  ([] as string[])
    .concat((res.headers['set-cookie'] as string[] | undefined) ?? [])
    .find((c) => c.startsWith(`${name}=`));
const pair = (setCookie: string | undefined) => setCookie?.split(';')[0] ?? '';
const eventually = async (condition: () => boolean) => {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((r) => setTimeout(r, 20));
};

describe('A person who joins a salon gets the session that suits the account', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let sms: InMemorySmsSender;
  let accounts: StaffAccounts;
  let world: SalonWorld;
  let mireille: StaffAccount;
  let akwa: WorldSalon;
  let elegance: WorldSalon;
  let nextNumber = 655_000_000;

  beforeAll(async () => {
    clock = new FixedClock(NOW_ON_THE_20TH);
    sms = new InMemorySmsSender();
    t = await startTestApp({
      controllers: [WhoAmIController],
      overrides: [
        [CLOCK, clock],
        [SMS_SENDER, sms],
      ],
    });
    db = t.moduleRef.get(getDataSourceToken());
    accounts = new StaffAccounts(db);
    world = new SalonWorld(db);
    mireille = await accounts.create('Mireille Ndongo');
    const clarisse = await accounts.create('Clarisse Fotso');
    [akwa] = (await world.organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
    ])) as [WorldSalon];
    [elegance] = (await world.organizationOf(clarisse.id, [
      { name: 'Élégance Bonamoussadi', city: 'Douala', district: 'Bonamoussadi' },
    ])) as [WorldSalon];
  });
  afterAll(() => t.close());

  /** Un numéro neuf par test : aucun compte, aucune invitation. */
  const aNewcomer = () => {
    const national = String(nextNumber++);
    const typed = `${national[0]} ${national.slice(1, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
    return { e164: `+237${national}`, typed };
  };
  const invite = async (
    salon: WorldSalon,
    e164: string,
    role = 'HAIRDRESSER',
    over: { expiresAt?: Date } = {},
  ): Promise<string> => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, notified_by_sms, version)
       VALUES ($1, $2, 'Brice Nana', $3, $4, $5, $6, $7, 'PENDING', false, 1)`,
      [id, salon.id, e164, role, mireille.id, INVITED_AT, over.expiresAt ?? new Date(INVITED_AT.getTime() + 7 * DAY_MS)],
    );
    return id;
  };
  const receiveCode = async (browser: Browser, person: { typed: string; e164: string }) => {
    const before = sms.sent.length;
    expect((await browser.post(CODE_PATH, { phone: person.typed })).status).toBe(202);
    await eventually(() => sms.sent.length > before);
    return codeIn(sms.lastTo(person.e164));
  };
  const prove = async (browser: Browser, person: { typed: string; e164: string }) => {
    const code = await receiveCode(browser, person);
    return browser.post(PROOF_PATH, { phone: person.typed, code });
  };
  const accept = async (browser: Browser, id: string, body: object = {}) => {
    const res = await browser.post(acceptancePath(id), body);
    if (res.status === 200 && res.body.data.csrfToken) browser.useCsrfToken(res.body.data.csrfToken);
    return res;
  };
  const whoAmI = (browser: Browser) => browser.get('/api/salon/probe-join/me');
  const rowsOf = (table: string, where: string, ...values: unknown[]) =>
    db.query(`SELECT * FROM ${table} WHERE ${where}`, values);

  describe('the session after the acceptance', () => {
    it('regenerates the session of a staff member already signed in here, in the salon joined, with a new token', async () => {
      const paul = await accounts.create('Paul Ebode');
      const id = await invite(akwa, paul.e164, 'SALON_ADMIN');
      const browser = t.browser();
      const signedIn = await accounts.signIn(browser, paul);
      const before = pair(cookieOf(signedIn, 'gmc.sid'));
      const tokenBefore = signedIn.body.data.csrfToken;
      await prove(browser, paul);

      const res = await accept(browser, id);

      expect(res.status).toBe(200);
      expect(InvitationAcceptedSchema.parse(res.body.data)).toMatchObject({
        outcome: 'SIGNED_IN',
        session: { user: { id: paul.id }, activeSalonId: akwa.id },
      });
      expect(res.body.data.csrfToken).not.toBe(tokenBefore);
      expect(pair(cookieOf(res, 'gmc.sid'))).not.toBe(before);
      expect((await whoAmI(browser)).body.data).toEqual({ userId: paul.id, activeSalonId: akwa.id });
      expect((await t.browser().agent.get('/api/salon/probe-join/me').set('Cookie', before)).status).toBe(
        401,
      );
    });

    it('opens no session for a staff member nobody is signed in as, and shows neither the name nor the other salons', async () => {
      const paul = await accounts.create('Paul Ebode');
      const id = await invite(akwa, paul.e164, 'SALON_ADMIN');
      const browser = t.browser();
      await prove(browser, paul);

      const res = await accept(browser, id);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ outcome: 'SIGN_IN_REQUIRED', salonName: 'Go Beauty Akwa' });
      expect((await whoAmI(browser)).status).toBe(401);
      expect(
        await rowsOf('salon_memberships', 'salon_id = $1 AND user_id = $2', akwa.id, paul.id),
      ).toHaveLength(1);
    });

    it('gives the membership to the owner of the number, leaving the account signed in on the tablet untouched', async () => {
      const paul = await accounts.create('Paul Ebode');
      const tablet = t.browser();
      await accounts.signIn(tablet, mireille);
      const id = await invite(elegance, paul.e164, 'SALON_ADMIN');
      await prove(tablet, paul);

      const res = await accept(tablet, id);

      expect(res.body.data).toEqual({ outcome: 'SIGN_IN_REQUIRED', salonName: 'Élégance Bonamoussadi' });
      expect((await whoAmI(tablet)).body.data.userId).toBe(mireille.id);
      expect(
        await rowsOf('salon_memberships', 'salon_id = $1 AND user_id = $2', elegance.id, paul.id),
      ).toHaveLength(1);
      expect(
        await rowsOf('salon_memberships', 'salon_id = $1 AND user_id = $2', elegance.id, mireille.id),
      ).toHaveLength(0);
    });

    it('replaces the session of someone else on the tablet when a new account is created there', async () => {
      const brice = aNewcomer();
      const id = await invite(akwa, brice.e164);
      const tablet = t.browser();
      const signedIn = await accounts.signIn(tablet, mireille);
      const mireilleSession = pair(cookieOf(signedIn, 'gmc.sid'));
      await prove(tablet, brice);

      const res = await accept(tablet, id, DETAILS);

      expect(res.status).toBe(200);
      expect((await whoAmI(tablet)).body.data.userId).not.toBe(mireille.id);
      expect(
        (await t.browser().agent.get('/api/salon/probe-join/me').set('Cookie', mireilleSession)).status,
      ).toBe(401);
    });

    it('refuses details sent for an account that already exists, asking to reload', async () => {
      const paul = await accounts.create('Paul Ebode');
      const id = await invite(akwa, paul.e164, 'SALON_ADMIN');
      const browser = t.browser();
      await prove(browser, paul);

      const res = await accept(browser, id, DETAILS);

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        code: 'ACCOUNT_STATE_CHANGED',
        message: 'Votre compte vient de changer : rechargez la page.',
      });
    });
  });

  describe('the proof of the number does not outlive its use', () => {
    it('is forgotten by the server and cleared from the browser when someone signs out of the shared tablet', async () => {
      const brice = aNewcomer();
      await invite(akwa, brice.e164);
      const tablet = t.browser();
      const proven = await prove(tablet, brice);
      const stolenCookie = pair(cookieOf(proven, 'gmc.join'));
      expect((await tablet.get('/api/public/invitations')).status).toBe(200);

      const out = await tablet.post('/api/public/auth/sign-out');

      expect(out.status).toBe(200);
      expect(cookieOf(out, 'gmc.join')).toMatch(/^gmc\.join=;/);
      const after = await tablet.get('/api/public/invitations');
      expect(after.status).toBe(422);
      expect(after.body.code).toBe('PHONE_PROOF_REQUIRED');
      const replayed = await t.browser().agent.get('/api/public/invitations').set('Cookie', stolenCookie);
      expect(replayed.body.code).toBe('PHONE_PROOF_REQUIRED');
      expect(await rowsOf('phone_proofs', 'phone = $1', brice.e164)).toHaveLength(0);
    });

    it('is forgotten, with its cookie, once the last pending invitation of the number is accepted', async () => {
      const paul = await accounts.create('Paul Ebode');
      const id = await invite(akwa, paul.e164, 'SALON_ADMIN');
      const browser = t.browser();
      await prove(browser, paul);

      const res = await accept(browser, id);

      expect(cookieOf(res, 'gmc.join')).toMatch(/^gmc\.join=;/);
      expect((await browser.get('/api/public/invitations')).body.code).toBe('PHONE_PROOF_REQUIRED');
    });

    it('stays valid while another invitation of the number can still be accepted', async () => {
      const paul = await accounts.create('Paul Ebode');
      const first = await invite(akwa, paul.e164, 'SALON_ADMIN');
      await invite(elegance, paul.e164, 'SALON_ADMIN');
      const browser = t.browser();
      await prove(browser, paul);

      const res = await accept(browser, first);

      expect(cookieOf(res, 'gmc.join')).toBeUndefined();
      expect((await browser.get('/api/public/invitations')).status).toBe(200);
    });
  });

  it('removes an accepted invitation from the list of the salon', async () => {
    const brice = aNewcomer();
    const id = await invite(akwa, brice.e164);
    const owner = t.browser();
    await accounts.signIn(owner, mireille);
    await owner.post('/api/salon/session/active-salon', { salonId: akwa.id });
    const before = await owner.get('/api/salon/invitations');
    expect(before.body.data.map((i: { id: string }) => i.id)).toContain(id);
    const browser = t.browser();
    await prove(browser, brice);

    await accept(browser, id, DETAILS);

    const after = await owner.get('/api/salon/invitations');
    expect(after.body.data.map((i: { id: string }) => i.id)).not.toContain(id);
  });
});
