import { randomUUID } from 'node:crypto';
import { ClientSessionSummarySchema, ClientSignedInSchema, SignUpCodeSentSchema } from '@gomecoiffer/contracts';
import { Controller, Get } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLOCK } from '../../../../shared/application/ports.js';
import {
  RequiresPermission,
  RequiresSystemRole,
} from '../../../../shared/infrastructure/security/decorators.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SMS_SENDER } from '../../domain/ports/sms-sender.port.js';
import { Argon2PasswordVerifier } from '../../infrastructure/crypto/secrets.js';
import { InMemorySmsSender } from '../fakes/identity-fakes.js';

@Controller('salon/probe-client-separation')
class SalonPlanningProbeController {
  @Get('planning')
  @RequiresPermission('bookings:manage')
  planning() {
    return { ok: true };
  }
}

@Controller('admin/probe-client-separation')
class AdminProbeController {
  @Get()
  @RequiresSystemRole('SUPER_ADMIN')
  admin() {
    return { ok: true };
  }
}

const PASSWORD = 'Bastos-Fade-2026';
const NEW_PASSWORD = 'Wouri-Degrade-2027';
const STAFF_ONLY_MESSAGE =
  'Cet espace est réservé aux salons. Connectez-vous avec votre mot de passe, ou créez votre compte salon.';

const codeIn = (sms: string | undefined) => sms?.match(/\b(\d{6})\b/)?.[1] ?? '';
const setCookies = (res: { headers: Record<string, unknown> }) =>
  ([] as string[]).concat((res.headers['set-cookie'] as string[] | undefined) ?? []);
const cookieNamed = (res: { headers: Record<string, unknown> }, name: string) =>
  setCookies(res).find((c) => c.startsWith(`${name}=`));
const expiryOf = (setCookie: string | undefined) =>
  Date.parse(/Expires=([^;]+)/.exec(setCookie ?? '')?.[1] ?? '');
const cookiePair = (setCookie: string | undefined) => setCookie?.split(';')[0] ?? '';
const eventually = async (condition: () => boolean) => {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((r) => setTimeout(r, 20));
};

describe('A client accesses the client space with a code received by SMS (UC-009)', () => {
  let t: TestApp;
  let db: DataSource;
  let sms: InMemorySmsSender;
  let clock: FixedClock;
  let passwordHash: string;
  let nextPhone = 694_100_000;

  const freshNumber = () => {
    const national = String(nextPhone++);
    return {
      national,
      e164: `+237${national}`,
      typed: `${national[0]} ${national.slice(1, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`,
      masked: `${national[0]} ${national.slice(1, 3)} •• •• ${national.slice(7)}`,
    };
  };

  const seedLightClient = async () => {
    const phone = freshNumber();
    const id = randomUUID();
    const verifiedAt = new Date('2026-11-02T09:00:00Z');
    await db.query(
      `INSERT INTO users (id, phone, name, email, password_hash, phone_verified_at, holder_since, terms_accepted_at, created_at, version)
       VALUES ($1, $2, NULL, NULL, NULL, $3, $3, $3, $3, 1)`,
      [id, phone.e164, verifiedAt],
    );
    return { id, ...phone };
  };

  const seedStaff = async (name = 'Paul Ebode') => {
    const phone = freshNumber();
    const id = randomUUID();
    const now = new Date('2026-11-01T09:00:00Z');
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, holder_since, terms_accepted_at, created_at, version)
       VALUES ($1, $2, $3, $4, $5, $5, $5, $5, 1)`,
      [id, phone.e164, name, passwordHash, now],
    );
    return { id, name, ...phone };
  };

  const requestClientCode = (browser: Browser, phone: string, termsAccepted: unknown = true) =>
    browser.post('/api/public/client/code', { phone, termsAccepted });

  const verifyClientCode = async (browser: Browser, phone: string, code: string) => {
    const res = await browser.post('/api/public/client/session', { phone, code });
    if (res.status === 200) browser.useCsrfToken(res.body.data.csrfToken);
    return res;
  };

  const signInAsClient = async (browser: Browser, person: { typed: string; e164: string }) => {
    const sent = await requestClientCode(browser, person.typed, true);
    expect(sent.status).toBe(202);
    const code = codeIn(sms.lastTo(person.e164));
    const verified = await verifyClientCode(browser, person.typed, code);
    expect(verified.status).toBe(200);
    return verified;
  };

  const signInWithPassword = async (browser: Browser, typed: string, password = PASSWORD) => {
    const res = await browser.post('/api/public/auth/sign-in', { phone: typed, password });
    if (res.status === 200) browser.useCsrfToken(res.body.data.csrfToken);
    return res;
  };

  beforeAll(async () => {
    clock = new FixedClock(new Date('2026-11-20T09:00:00Z'));
    sms = new InMemorySmsSender();
    t = await startTestApp({
      controllers: [SalonPlanningProbeController, AdminProbeController],
      overrides: [
        [CLOCK, clock],
        [SMS_SENDER, sms],
      ],
    });
    db = t.moduleRef.get(getDataSourceToken());
    passwordHash = await new Argon2PasswordVerifier().rehash(PASSWORD);
  });
  afterAll(() => t?.close());

  it('creates a light client account on code verification, opens a fresh 7-day client session with a rotated CSRF token and returns the masked phone summary (T16)', async () => {
    const nadege = freshNumber();
    const browser = t.browser();
    const visit = await browser.get('/api/public/session/csrf');
    const visitorSession = cookiePair(cookieNamed(visit, 'gmc.sid'));
    const visitorToken = visit.body.data.csrfToken as string;

    const asked = await requestClientCode(browser, nadege.typed, true);
    expect(asked.status).toBe(202);
    expect(SignUpCodeSentSchema.safeParse(asked.body.data).success).toBe(true);
    expect(asked.body.data).toEqual({
      maskedPhone: nadege.masked,
      expiresInSeconds: 300,
      resendInSeconds: 60,
    });
    const code = codeIn(sms.lastTo(nadege.e164));
    expect(sms.lastTo(nadege.e164)).toBe(
      `GoMeCoiffer : votre code pour retrouver vos réservations est ${code}. Il expire dans 5 minutes. Ne le communiquez à personne.`,
    );

    const verified = await verifyClientCode(browser, nadege.typed, code);
    expect(verified.status).toBe(200);
    expect(ClientSignedInSchema.safeParse(verified.body.data).success).toBe(true);
    expect(verified.body.data).toEqual({
      csrfToken: expect.any(String),
      session: {
        kind: 'CLIENT',
        maskedPhone: nadege.masked,
      },
    });
    expect(verified.body.data.csrfToken).not.toBe(visitorToken);
    const clientCookie = cookieNamed(verified, 'gmc.sid');
    expect(cookiePair(clientCookie)).not.toBe(visitorSession);
    expect(clientCookie).toMatch(/HttpOnly/);
    expect(clientCookie).toMatch(/SameSite=Lax/);
    // Le cookie de session client porte une durée de 7 jours (168 h)
    expect(expiryOf(clientCookie)).toBeGreaterThan(Date.now() + 167.5 * 3_600_000);
    expect(expiryOf(clientCookie)).toBeLessThan(Date.now() + 168.5 * 3_600_000);

    // L'ancien jeton CSRF d'avant la connexion est refusé
    const withOldToken = await browser.agent
      .post('/api/public/auth/sign-out')
      .set('x-csrf-token', visitorToken)
      .send();
    expect(withOldToken.status).toBe(403);
    expect(withOldToken.body.code).toBe('CSRF_INVALID');

    const summary = await browser.get('/api/client/session');
    expect(summary.status).toBe(200);
    expect(ClientSessionSummarySchema.safeParse(summary.body.data).success).toBe(true);
    expect(summary.body.data).toEqual({
      kind: 'CLIENT',
      maskedPhone: nadege.masked,
    });

    const [userRow] = await db.query(
      `SELECT name, email, password_hash AS "passwordHash", phone_verified_at AS "phoneVerifiedAt", holder_since AS "holderSince" FROM users WHERE phone = $1`,
      [nadege.e164],
    );
    expect(userRow).toEqual({
      name: null,
      email: null,
      passwordHash: null,
      phoneVerifiedAt: clock.now(),
      holderSince: clock.now(),
    });
  });

  it('returns identical code request and verification responses for a number without account, a light client and a staff member (T17)', async () => {
    const nadege = freshNumber();
    const aicha = await seedLightClient();
    const paul = await seedStaff('Paul Ebode');

    const reqNadege = await requestClientCode(t.browser(), nadege.typed, true);
    const reqAicha = await requestClientCode(t.browser(), aicha.typed, true);
    const reqPaul = await requestClientCode(t.browser(), paul.typed, true);

    const normalizeCodeSent = (res: typeof reqNadege) => ({
      status: res.status,
      data: { ...res.body.data, maskedPhone: 'X' },
    });
    expect(normalizeCodeSent(reqAicha)).toEqual(normalizeCodeSent(reqNadege));
    expect(normalizeCodeSent(reqPaul)).toEqual(normalizeCodeSent(reqNadege));

    const verNadege = await verifyClientCode(t.browser(), nadege.typed, codeIn(sms.lastTo(nadege.e164)));
    const verAicha = await verifyClientCode(t.browser(), aicha.typed, codeIn(sms.lastTo(aicha.e164)));
    const verPaul = await verifyClientCode(t.browser(), paul.typed, codeIn(sms.lastTo(paul.e164)));

    const normalizeVerified = (res: typeof verNadege) => ({
      status: res.status,
      data: {
        csrfToken: 'TOKEN',
        session: { ...res.body.data.session, maskedPhone: 'X' },
      },
    });
    expect(normalizeVerified(verAicha)).toEqual(normalizeVerified(verNadege));
    expect(normalizeVerified(verPaul)).toEqual(normalizeVerified(verNadege));
    expect(JSON.stringify(verPaul.body)).not.toContain('Paul');

    // Un seul compte par numéro, et Paul se connecte toujours avec son mot de passe
    for (const person of [nadege, aicha, paul]) {
      const count = Number(
        (await db.query(`SELECT count(*) AS n FROM users WHERE phone = $1`, [person.e164]))[0].n,
      );
      expect(count).toBe(1);
    }
    expect((await signInWithPassword(t.browser(), paul.typed, PASSWORD)).status).toBe(200);
  });

  it('blocks a client session from every salon and platform administration route with 403 STAFF_SIGN_IN_REQUIRED, even for a staff user signed in by SMS (T18)', async () => {
    const aicha = await seedLightClient();
    const paul = await seedStaff('Paul Ebode');
    const aichaBrowser = t.browser();
    const paulClientBrowser = t.browser();
    await signInAsClient(aichaBrowser, aicha);
    await signInAsClient(paulClientBrowser, paul);

    for (const browser of [aichaBrowser, paulClientBrowser]) {
      const createOrg = await browser.post('/api/salon/organizations', {
        name: 'Aïcha Coiffure',
        type: 'WOMEN',
        city: 'Douala',
        district: 'Akwa',
        landmark: 'Carrefour Soudanaise',
        phone: '6 55 44 33 22',
      });
      const salonSession = await browser.get('/api/salon/session');
      const chooseSalon = await browser.post('/api/salon/session/active-salon', {
        salonId: '0195f000-0000-7000-8000-000000000b02',
      });
      const planning = await browser.get('/api/salon/probe-client-separation/planning');
      const admin = await browser.get('/api/admin/probe-client-separation');

      for (const res of [createOrg, salonSession, chooseSalon, planning, admin]) {
        expect([res.status, res.body.code, res.body.message]).toEqual([
          403,
          'STAFF_SIGN_IN_REQUIRED',
          STAFF_ONLY_MESSAGE,
        ]);
      }
    }

    const orgCount = Number(
      (await db.query(`SELECT count(*) AS n FROM organizations WHERE name = 'Aïcha Coiffure'`))[0].n,
    );
    expect(orgCount).toBe(0);
  });

  it('lets a staff member signed in with a password open the client space without requesting any SMS code (T19)', async () => {
    const paul = await seedStaff('Paul Ebode');
    const browser = t.browser();
    const smsBefore = sms.sent.length;
    await signInWithPassword(browser, paul.typed, PASSWORD);

    const res = await browser.get('/api/client/session');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      kind: 'STAFF',
      maskedPhone: paul.masked,
    });
    expect(sms.sent.length).toBe(smsBefore);
  });

  it('replaces the staff session already open on a shared tablet when a client verifies her phone number on it (T20)', async () => {
    const mireille = await seedStaff('Mireille Ndongo');
    const aicha = await seedLightClient();
    const tablet = t.browser();

    const mireilleSignedIn = await signInWithPassword(tablet, mireille.typed, PASSWORD);
    const mireilleCookie = cookiePair(cookieNamed(mireilleSignedIn, 'gmc.sid'));

    await signInAsClient(tablet, aicha);

    const clientSpace = await tablet.get('/api/client/session');
    expect(clientSpace.status).toBe(200);
    expect(clientSpace.body.data).toEqual({
      kind: 'CLIENT',
      maskedPhone: aicha.masked,
    });

    const replayedMireille = await t
      .browser()
      .agent.get('/api/salon/session')
      .set('Cookie', mireilleCookie);
    expect(replayedMireille.status).toBe(401);
    expect(replayedMireille.body.message).toBe('Session absente ou expirée : reconnectez-vous.');
  });

  it('sends a single SMS on a burst of 5 simultaneous requests, and refuses requests without CSRF token or terms acceptance without counting anything (T21)', async () => {
    const nadege = freshNumber();

    // 1. Sans jeton CSRF -> 403, rien envoyé ni compté
    const withoutCsrf = await t
      .browser()
      .agent.post('/api/public/client/code')
      .send({ phone: nadege.typed, termsAccepted: true });
    expect(withoutCsrf.status).toBe(403);
    expect(withoutCsrf.body.message).toBe(
      'Jeton de sécurité absent ou expiré : rechargez la page puis recommencez.',
    );
    expect(sms.sent.filter((s) => s.to === nadege.e164)).toEqual([]);

    // 2. Sans acceptation des conditions -> 400, rien envoyé ni compté
    const withoutTerms = await requestClientCode(t.browser(), nadege.typed, false);
    expect(withoutTerms.status).toBe(400);
    expect(withoutTerms.body.errors).toEqual([
      { path: 'termsAccepted', message: "Acceptez les conditions d'utilisation pour continuer." },
    ]);
    expect(sms.sent.filter((s) => s.to === nadege.e164)).toEqual([]);

    // 3. Rafale de 5 demandes simultanées -> 1 seul SMS envoyé, 4 refus OTP_RESEND_TOO_SOON
    const burst = await Promise.all(
      Array.from({ length: 5 }, () => requestClientCode(t.browser(), nadege.typed, true)),
    );
    expect(burst.map((r) => r.status).sort()).toEqual([202, 422, 422, 422, 422]);
    expect(burst.filter((r) => r.status === 422).every((r) => r.body.code === 'OTP_RESEND_TOO_SOON')).toBe(
      true,
    );
    expect(sms.sent.filter((s) => s.to === nadege.e164)).toHaveLength(1);
  });

  it('expires a client session after 7 days of inactivity or 30 days absolute, closes it on sign-out, and invalidates it when the account password is reset (T22)', async () => {
    // 1. Expiration par inactivité (7 j = 168 h)
    const inactiveClient = await seedLightClient();
    const inactiveBrowser = t.browser();
    const start = new Date('2026-11-20T09:00:00Z');
    clock.set(start);
    await signInAsClient(inactiveBrowser, inactiveClient);

    clock.set(new Date(start.getTime() + (168 * 60 - 1) * 60_000));
    expect((await inactiveBrowser.get('/api/client/session')).status).toBe(200);

    // Repartons de start sans activité intermédiaire pour dépasser 7 j à +168 h 01 min
    const inactiveClient2 = await seedLightClient();
    const inactiveBrowser2 = t.browser();
    clock.set(start);
    await signInAsClient(inactiveBrowser2, inactiveClient2);
    clock.set(new Date(start.getTime() + (168 * 60 + 1) * 60_000));
    const expiredByInactivity = await inactiveBrowser2.get('/api/client/session');
    expect(expiredByInactivity.status).toBe(401);
    expect(expiredByInactivity.body.message).toBe('Session absente ou expirée : reconnectez-vous.');

    // 2. Expiration absolue (30 j = 720 h) malgré une activité régulière tous les 5 jours
    const activeClient = await seedLightClient();
    const activeBrowser = t.browser();
    clock.set(start);
    await signInAsClient(activeBrowser, activeClient);
    for (const day of [5, 10, 15, 20, 25]) {
      clock.set(new Date(start.getTime() + day * 24 * 3_600_000));
      expect((await activeBrowser.get('/api/client/session')).status).toBe(200);
    }
    clock.set(new Date(start.getTime() + (720 * 60 - 1) * 60_000));
    expect((await activeBrowser.get('/api/client/session')).status).toBe(200);
    clock.set(new Date(start.getTime() + (720 * 60 + 1) * 60_000));
    const expiredByMaxAge = await activeBrowser.get('/api/client/session');
    expect(expiredByMaxAge.status).toBe(401);
    expect(expiredByMaxAge.body.message).toBe('Session absente ou expirée : reconnectez-vous.');

    clock.set(start);

    // 3. Déconnexion d'une session client : cookies effacés et ancien cookie refusé
    const aicha = await seedLightClient();
    const aichaBrowser = t.browser();
    const verified = await signInAsClient(aichaBrowser, aicha);
    const copiedCookie = cookiePair(cookieNamed(verified, 'gmc.sid'));

    const signedOut = await aichaBrowser.post('/api/public/auth/sign-out');
    expect(signedOut.status).toBe(200);
    expect(cookieNamed(signedOut, 'gmc.sid')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookieNamed(signedOut, 'gmc.x-csrf')).toMatch(/Expires=Thu, 01 Jan 1970/);
    const replayedAfterSignOut = await t
      .browser()
      .agent.get('/api/client/session')
      .set('Cookie', copiedCookie);
    expect(replayedAfterSignOut.status).toBe(401);

    // 4. Réinitialisation du mot de passe de Paul : ferme aussi sa session client
    const paul = await seedStaff('Paul Ebode');
    const paulPhoneBrowser = t.browser();
    await signInAsClient(paulPhoneBrowser, paul);
    expect((await paulPhoneBrowser.get('/api/client/session')).status).toBe(200);

    const tablet = t.browser();
    const beforeSms = sms.sent.length;
    expect(
      (await tablet.post('/api/public/auth/password-reset/code', { phone: paul.typed })).status,
    ).toBe(202);
    await eventually(() => sms.sent.length > beforeSms);
    const resetCode = codeIn(sms.lastTo(paul.e164));
    const resetRes = await tablet.post('/api/public/auth/password-reset', {
      phone: paul.typed,
      code: resetCode,
      newPassword: NEW_PASSWORD,
    });
    expect(resetRes.status).toBe(200);

    const clientSessionAfterReset = await paulPhoneBrowser.get('/api/client/session');
    expect(clientSessionAfterReset.status).toBe(401);
    expect(clientSessionAfterReset.body.message).toBe('Session absente ou expirée : reconnectez-vous.');
  });

  it('records CLIENT_ACCOUNT_CREATED and CLIENT_SIGNED_IN in audit_log without leaking the phone number or the OTP code (T23)', async () => {
    const nadege = freshNumber();
    const browser = t.browser();
    await requestClientCode(browser, nadege.typed, true);
    const code = codeIn(sms.lastTo(nadege.e164));

    await verifyClientCode(browser, nadege.typed, code);

    const [user] = await db.query(`SELECT id FROM users WHERE phone = $1`, [nadege.e164]);
    const rows = await db.query(
      `SELECT action, subject_type AS "subjectType", subject_id AS "subjectId", actor_user_id AS "actorUserId", details::text AS details
       FROM audit_log WHERE subject_id = $1 ORDER BY occurred_at, action`,
      [user.id],
    );
    expect(rows).toEqual([
      {
        action: 'CLIENT_ACCOUNT_CREATED',
        subjectType: 'user',
        subjectId: user.id,
        actorUserId: user.id,
        details: '{}',
      },
      {
        action: 'CLIENT_SIGNED_IN',
        subjectType: 'user',
        subjectId: user.id,
        actorUserId: user.id,
        details: '{}',
      },
    ]);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(nadege.national);
    expect(serialized).not.toContain(code);
  });
});
