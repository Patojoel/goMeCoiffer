import { randomUUID } from 'node:crypto';
import {
  InvitationAcceptedSchema,
  InvitationPhoneProvenSchema,
  SignUpCodeSentSchema,
} from '@gomecoiffer/contracts';
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
const UNKNOWN_ID = '0195f000-0000-7000-8000-00000000dead';
const NO_PROOF = 'Votre vérification a expiré : demandez un nouveau code pour continuer.';

const codeIn = (text: string | undefined) => text?.match(/\b(\d{6})\b/)?.[1] ?? '';
const cookieOf = (res: { headers: Record<string, unknown> }, name: string) =>
  ([] as string[])
    .concat((res.headers['set-cookie'] as string[] | undefined) ?? [])
    .find((c) => c.startsWith(`${name}=`));
const pair = (setCookie: string | undefined) => setCookie?.split(';')[0] ?? '';
const eventually = async (condition: () => boolean) => {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((r) => setTimeout(r, 20));
};

describe('A person invited to a salon proves the number and joins the team', () => {
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

  it('walks from the number to a connected session in the salon, then joins a second salon in one click', async () => {
    const brice = aNewcomer();
    const akwaInvitation = await invite(akwa, brice.e164, 'HAIRDRESSER');
    const eleganceInvitation = await invite(elegance, brice.e164, 'SALON_ADMIN');
    const browser = t.browser();
    const visit = await browser.get('/api/public/session/csrf');
    const visitorSession = pair(cookieOf(visit, 'gmc.sid'));

    const asked = await browser.post(CODE_PATH, { phone: brice.typed });
    expect(SignUpCodeSentSchema.safeParse(asked.body.data).success).toBe(true);
    await eventually(() => sms.lastTo(brice.e164) !== undefined);
    expect(sms.lastTo(brice.e164)).toMatch(
      /^GoMeCoiffer : votre code pour rejoindre une équipe est \d{6}\. Il expire dans 5 minutes\. Ne le communiquez à personne\.$/,
    );

    const proven = await browser.post(PROOF_PATH, {
      phone: brice.typed,
      code: codeIn(sms.lastTo(brice.e164)),
    });
    expect(proven.status).toBe(200);
    expect(InvitationPhoneProvenSchema.parse(proven.body.data).provenUntil).toBe(
      new Date(NOW_ON_THE_20TH.getTime() + 15 * 60_000).toISOString(),
    );
    const proofCookie = cookieOf(proven, 'gmc.join')!;
    expect(proofCookie).toMatch(/HttpOnly/);
    expect(proofCookie).toMatch(/SameSite=Strict/);
    expect(proofCookie).toMatch(/Path=\/;/);
    expect(proofCookie).not.toMatch(/Domain=/);
    expect(JSON.stringify(proven.body)).not.toContain(pair(proofCookie).split('=')[1]);

    const joined = await accept(browser, akwaInvitation, DETAILS);

    expect(joined.status).toBe(200);
    const done = InvitationAcceptedSchema.parse(joined.body.data);
    expect(done).toMatchObject({
      outcome: 'SIGNED_IN',
      salonName: 'Go Beauty Akwa',
      session: { user: { name: 'Brice Nana' }, activeSalonId: akwa.id, nextStep: 'OPEN_SALON' },
    });
    expect(pair(cookieOf(joined, 'gmc.sid'))).not.toBe(visitorSession);
    const me = (await whoAmI(browser)).body.data;
    expect(me).toMatchObject({ activeSalonId: akwa.id });
    expect(
      (await t.browser().post('/api/public/auth/sign-in', { phone: brice.typed, password: PASSWORD })).status,
    ).toBe(200);
    expect(await rowsOf('salon_invitations', 'id = $1', akwaInvitation)).toMatchObject([
      { status: 'ACCEPTED', accepted_by_user_id: me.userId, name: null, phone: null },
    ]);
    expect(
      await rowsOf('salon_memberships', 'salon_id = $1 AND user_id = $2', akwa.id, me.userId),
    ).toMatchObject([{ role: 'HAIRDRESSER', status: 'ACTIVE' }]);
    expect(await rowsOf('salon_invitations', 'id = $1', eleganceInvitation)).toMatchObject([
      { status: 'PENDING' },
    ]);

    const secondSessionBefore = pair(cookieOf(joined, 'gmc.sid'));
    expect((await browser.get('/api/public/invitations')).status).toBe(200);
    expect(cookieOf(joined, 'gmc.join')).toBeUndefined();
    const second = await accept(browser, eleganceInvitation);

    expect(second.status).toBe(200);
    expect(InvitationAcceptedSchema.parse(second.body.data)).toMatchObject({
      outcome: 'SIGNED_IN',
      salonName: 'Élégance Bonamoussadi',
      session: { activeSalonId: elegance.id },
    });
    expect(pair(cookieOf(second, 'gmc.sid'))).not.toBe(secondSessionBefore);
    expect((await whoAmI(browser)).body.data).toEqual({ userId: me.userId, activeSalonId: elegance.id });
    expect(await rowsOf('users', 'phone = $1', brice.e164)).toHaveLength(1);
    expect(cookieOf(second, 'gmc.join')).toMatch(/^gmc\.join=;/);
    const afterTheLast = await browser.get('/api/public/invitations');
    expect(afterTheLast.status).toBe(422);
    expect(afterTheLast.body.code).toBe('PHONE_PROOF_REQUIRED');
    expect(await rowsOf('phone_proofs', 'phone = $1', brice.e164)).toHaveLength(0);
  });

  it('forbids any cache to keep the answers about invitations', async () => {
    const brice = aNewcomer();
    await invite(akwa, brice.e164);
    const browser = t.browser();
    await prove(browser, brice);

    const listed = await browser.get('/api/public/invitations');
    const refused = await t.browser().get('/api/public/invitations');

    expect(listed.status).toBe(200);
    expect(listed.headers['cache-control']).toBe('no-store');
    expect(refused.status).toBe(422);
    expect(refused.headers['cache-control']).toBe('no-store');
  });

  it('traces the acceptance without the name, the number, the code or the password', async () => {
    const brice = aNewcomer();
    const id = await invite(akwa, brice.e164);
    const browser = t.browser();
    await prove(browser, brice);
    await accept(browser, id, DETAILS);

    const trace = JSON.stringify(
      await db.query(
        `SELECT action, details FROM audit_log WHERE subject_id = $1 OR actor_user_id IN (SELECT id FROM users WHERE phone = $2)`,
        [id, brice.e164],
      ),
    );

    expect(trace).toContain('INVITATION_ACCEPTED');
    expect(trace).toContain('COLLABORATOR_ACCOUNT_CREATED');
    expect(trace).not.toMatch(new RegExp(`Brice|${brice.e164.slice(4)}|Wouri`));
  });

  describe('before the proof, nothing shows whether a number is invited', () => {
    it('answers every number the same way, and sends a code only to those with a pending invitation', async () => {
      const invited = aNewcomer();
      const invitedStaff = await accounts.create('Paul Ebode');
      const nobody = aNewcomer();
      const expired = aNewcomer();
      await invite(akwa, invited.e164);
      await invite(elegance, invitedStaff.e164, 'SALON_ADMIN');
      await invite(akwa, expired.e164, 'HAIRDRESSER', { expiresAt: new Date(INVITED_AT.getTime() - DAY_MS) });
      const sentBefore = sms.sent.length;

      const answers = [];
      for (const person of [invited, { typed: invitedStaff.typed, e164: invitedStaff.e164 }, nobody, expired])
        answers.push(await t.browser().post(CODE_PATH, { phone: person.typed }));
      await eventually(() => sms.sent.length >= sentBefore + 2);
      await new Promise((r) => setTimeout(r, 100));

      expect(answers.map((a) => a.status)).toEqual([202, 202, 202, 202]);
      expect(answers.map((a) => Object.keys(a.body.data).sort())).toEqual(
        Array(4).fill(['expiresInSeconds', 'maskedPhone', 'resendInSeconds']),
      );
      expect(answers.map((a) => a.body.data.expiresInSeconds)).toEqual([300, 300, 300, 300]);
      expect(
        sms.sent
          .slice(sentBefore)
          .map((s) => s.to)
          .sort(),
      ).toEqual([invited.e164, invitedStaff.e164].sort());
    });

    it('refuses a wrong code in the same words for every number, invited or not', async () => {
      const invited = aNewcomer();
      const nobody = aNewcomer();
      await invite(akwa, invited.e164);
      const refusals = [];
      for (const person of [invited, nobody]) {
        const browser = t.browser();
        await receiveCode(browser, person).catch(() => '');
        await browser.post(CODE_PATH, { phone: person.typed });
        refusals.push(await browser.post(PROOF_PATH, { phone: person.typed, code: '000000' }));
      }

      expect(refusals.map((r) => [r.status, r.body.code, r.body.message])).toEqual(
        Array(2).fill([422, 'OTP_INCORRECT', 'Code incorrect. Il vous reste 4 essais.']),
      );
    });

    it('refuses a number that is not Cameroonian without counting anything, and a request without CSRF token', async () => {
      const brice = aNewcomer();
      await invite(akwa, brice.e164);
      const sentBefore = sms.sent.length;

      const malformed = await t.browser().post(CODE_PATH, { phone: '6 55 44 33 2' });
      const withoutToken = await t.browser().agent.post(CODE_PATH).send({ phone: brice.typed });
      await new Promise((r) => setTimeout(r, 100));

      expect(malformed.status).toBe(422);
      expect(withoutToken.status).toBe(403);
      expect(withoutToken.body.message).toBe(
        'Jeton de sécurité absent ou expiré : rechargez la page puis recommencez.',
      );
      expect(sms.sent.length).toBe(sentBefore);
      expect(await rowsOf('otp_challenges', 'phone = $1', brice.e164)).toHaveLength(0);
    });

    it('sends a single SMS when five requests for the same number arrive together', async () => {
      const brice = aNewcomer();
      await invite(akwa, brice.e164);
      const sentBefore = sms.sent.length;

      const answers = await Promise.all(
        Array.from({ length: 5 }, () => t.browser().post(CODE_PATH, { phone: brice.typed })),
      );
      await eventually(() => sms.sent.length > sentBefore);
      await new Promise((r) => setTimeout(r, 100));

      expect(answers.filter((a) => a.status === 202)).toHaveLength(1);
      expect(answers.filter((a) => a.status === 422).map((a) => a.body.code)).toEqual(
        Array(4).fill('OTP_RESEND_TOO_SOON'),
      );
      expect(sms.sent.length - sentBefore).toBe(1);
    });
  });

  describe('the proof of the number', () => {
    it('is not valid on another browser, nor without any code entered', async () => {
      const brice = aNewcomer();
      const id = await invite(akwa, brice.e164);
      await prove(t.browser(), brice);

      const elsewhere = await accept(t.browser(), id, DETAILS);

      expect(elsewhere.status).toBe(422);
      expect(elsewhere.body).toMatchObject({ code: 'PHONE_PROOF_REQUIRED', message: NO_PROOF });
      expect(await rowsOf('users', 'phone = $1', brice.e164)).toHaveLength(0);
    });

    it('is valid for 15 minutes, to the second', async () => {
      const brice = aNewcomer();
      const first = await invite(akwa, brice.e164);
      const second = await invite(elegance, brice.e164, 'SALON_ADMIN');
      const browser = t.browser();
      await prove(browser, brice);

      clock.set(new Date(NOW_ON_THE_20TH.getTime() + 15 * 60_000 - 1000));
      const inTime = await accept(browser, first, DETAILS);
      clock.set(new Date(NOW_ON_THE_20TH.getTime() + 15 * 60_000));
      const late = await accept(browser, second);
      clock.set(NOW_ON_THE_20TH);

      expect(inTime.status).toBe(200);
      expect(late.body).toMatchObject({ code: 'PHONE_PROOF_REQUIRED', message: NO_PROOF });
    });
  });

  describe('the invitation aimed at and what the request may carry', () => {
    it('answers an invitation of another number exactly like an unknown one, and leaves it pending', async () => {
      const brice = aNewcomer();
      const paul = aNewcomer();
      await invite(akwa, brice.e164);
      const pauls = await invite(akwa, paul.e164, 'SALON_ADMIN');
      const browser = t.browser();
      await prove(browser, brice);

      const ofPaul = await accept(browser, pauls, DETAILS);
      const unknown = await accept(browser, UNKNOWN_ID, DETAILS);

      expect([ofPaul.status, unknown.status]).toEqual([404, 404]);
      expect(ofPaul.body).toEqual(unknown.body);
      expect(await rowsOf('salon_invitations', 'id = $1', pauls)).toMatchObject([{ status: 'PENDING' }]);
    });

    it.each([
      ['a role', { role: 'OWNER' }],
      ['a salon', { salonId: UNKNOWN_ID }],
      ['another number', { phone: '6 99 00 11 22' }],
      ['a system role', { systemRole: 'SUPER_ADMIN' }],
    ])('refuses the whole request when it also carries %s, creating nothing', async (_label, extra) => {
      const brice = aNewcomer();
      const id = await invite(akwa, brice.e164);
      const browser = t.browser();
      await prove(browser, brice);

      const res = await accept(browser, id, { ...DETAILS, ...extra });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Certaines informations sont invalides : corrigez les champs signalés.');
      expect(await rowsOf('users', 'phone = $1', brice.e164)).toHaveLength(0);
    });

    it('refuses a malformed identifier, and details that are only half given', async () => {
      const brice = aNewcomer();
      const id = await invite(akwa, brice.e164);
      const browser = t.browser();
      await prove(browser, brice);

      expect((await accept(browser, 'not-a-uuid', DETAILS)).status).toBe(400);
      const half = await accept(browser, id, { name: 'Brice Nana' });
      expect(half.status).toBe(400);
      expect(half.body.errors.map((e: { path: string }) => e.path).sort()).toEqual([
        'password',
        'termsAccepted',
      ]);
    });

    it('keeps the proof and the invitation when the password is refused, then accepts the corrected one', async () => {
      const brice = aNewcomer();
      const id = await invite(akwa, brice.e164);
      const browser = t.browser();
      await prove(browser, brice);

      const weak = await accept(browser, id, { ...DETAILS, password: 'salon2026' });
      const retried = await accept(browser, id, DETAILS);

      expect(weak.status).toBe(422);
      expect(weak.body.code).toBe('PASSWORD_TOO_SHORT');
      expect(retried.status).toBe(200);
    });

    it('refuses an invitation that expired or was cancelled since the code was typed, creating no account', async () => {
      const brice = aNewcomer();
      const expiring = await invite(akwa, brice.e164, 'HAIRDRESSER', {
        expiresAt: new Date(NOW_ON_THE_20TH.getTime() + 60_000),
      });
      const cancelled = await invite(elegance, brice.e164, 'SALON_ADMIN');
      const browser = t.browser();
      await prove(browser, brice);
      await db.query(`UPDATE salon_invitations SET status = 'CANCELLED', ended_at = now() WHERE id = $1`, [
        cancelled,
      ]);
      clock.set(new Date(NOW_ON_THE_20TH.getTime() + 60_000));

      const late = await accept(browser, expiring, DETAILS);
      const gone = await accept(browser, cancelled, DETAILS);
      clock.set(NOW_ON_THE_20TH);

      for (const res of [late, gone]) {
        expect(res.status).toBe(422);
        expect(res.body.code).toBe('INVITATION_NO_LONGER_PENDING');
      }
      expect(await rowsOf('users', 'phone = $1', brice.e164)).toHaveLength(0);
    });

    it('answers the person who accepts twice "no longer pending", not "not found"', async () => {
      const brice = aNewcomer();
      const id = await invite(akwa, brice.e164);
      await invite(elegance, brice.e164, "SALON_ADMIN");
      const browser = t.browser();
      await prove(browser, brice);
      await accept(browser, id, DETAILS);

      const again = await accept(browser, id);

      expect(again.status).toBe(422);
      expect(again.body.code).toBe('INVITATION_NO_LONGER_PENDING');
    });
  });
});
