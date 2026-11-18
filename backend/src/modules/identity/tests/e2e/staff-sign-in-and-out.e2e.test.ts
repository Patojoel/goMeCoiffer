import { randomUUID } from 'node:crypto';
import { SignedInSchema, SignedOutSchema } from '@gomecoiffer/contracts';
import { Controller, Get } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Actor, CLOCK } from '../../../../shared/application/ports.js';
import {
  AuthenticatedOnly,
  CurrentActor,
  RequiresPermission,
} from '../../../../shared/infrastructure/security/decorators.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { Argon2PasswordVerifier } from '../../infrastructure/crypto/secrets.js';

@Controller('salon/probe-sign-in')
class WhoAmIController {
  @Get('me')
  @AuthenticatedOnly()
  me(@CurrentActor() actor: Actor) {
    return { userId: actor.userId, activeSalonId: actor.activeSalonId };
  }

  @Get('planning')
  @RequiresPermission('bookings:manage')
  planning() {
    return { ok: true };
  }
}

const PASSWORD = 'Bastos-Fade-2026';
const setCookies = (res: { headers: Record<string, unknown> }) =>
  ([] as string[]).concat((res.headers['set-cookie'] as string[] | undefined) ?? []);
const cookieNamed = (res: { headers: Record<string, unknown> }, name: string) =>
  setCookies(res).find((c) => c.startsWith(`${name}=`));
const expiryOf = (setCookie: string | undefined) =>
  Date.parse(/Expires=([^;]+)/.exec(setCookie ?? '')?.[1] ?? '');
const cookiePair = (setCookie: string | undefined) => setCookie?.split(';')[0] ?? '';

describe('A staff member signs in with a phone number and a password, then signs out', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let passwordHash: string;
  let nextPhone = 600_000_000;

  /** Un compte du personnel (numéro propre au test : les blocages d'un test ne touchent pas les autres). */
  async function staff(name: string, password = PASSWORD) {
    const national = String(nextPhone++);
    const id = randomUUID();
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, created_at, version)
       VALUES ($1, $2, $3, $4, now(), now(), 1)`,
      [
        id,
        `+237${national}`,
        name,
        password === PASSWORD ? passwordHash : await new Argon2PasswordVerifier().rehash(password),
      ],
    );
    return {
      id,
      national,
      e164: `+237${national}`,
      typed: `${national[0]} ${national.slice(1, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`,
    };
  }
  const signIn = async (browser: Browser, typed: string, password = PASSWORD) => {
    const res = await browser.post('/api/public/auth/sign-in', { phone: typed, password });
    if (res.status === 200) browser.useCsrfToken(res.body.data.csrfToken);
    return res;
  };
  const signOut = async (browser: Browser) => {
    const res = await browser.post('/api/public/auth/sign-out');
    browser.useCsrfToken(null);
    return res;
  };
  const attemptsFor = async (e164: string) =>
    Number((await db.query(`SELECT count(*) AS n FROM sign_in_attempts WHERE phone = $1`, [e164]))[0].n);

  beforeAll(async () => {
    clock = new FixedClock(new Date());
    t = await startTestApp({ controllers: [WhoAmIController], overrides: [[CLOCK, clock]] });
    db = t.moduleRef.get(getDataSourceToken());
    passwordHash = await new Argon2PasswordVerifier().rehash(PASSWORD);
  });
  afterAll(() => t.close());

  it('opens a brand new session without any salon, with a new CSRF token, and drops the visitor session and token', async () => {
    const paul = await staff('Paul Ebode');
    const browser = t.browser();
    const visit = await browser.get('/api/public/session/csrf');
    const visitorSession = cookiePair(cookieNamed(visit, 'gmc.sid'));
    const visitorToken = visit.body.data.csrfToken as string;

    const res = await signIn(browser, paul.typed);

    expect(res.status).toBe(200);
    expect(SignedInSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toMatchObject({
      csrfToken: expect.any(String),
      session: {
        user: { id: paul.id, name: 'Paul Ebode' },
        activeSalonId: null,
        salons: [],
        systemRoles: [],
        nextStep: 'CREATE_ORGANIZATION',
      },
    });
    expect(res.body.data.csrfToken).not.toBe(visitorToken);
    expect(cookiePair(cookieNamed(res, 'gmc.sid'))).not.toBe(visitorSession);
    expect(cookieNamed(res, 'gmc.sid')).toMatch(/HttpOnly/);
    expect(cookieNamed(res, 'gmc.sid')).toMatch(/SameSite=Lax/);
    expect(expiryOf(cookieNamed(res, 'gmc.sid'))).toBeGreaterThan(Date.now() + 23.9 * 3_600_000);
    expect(expiryOf(cookieNamed(res, 'gmc.sid'))).toBeLessThan(Date.now() + 24.1 * 3_600_000);
    expect((await browser.get('/api/salon/probe-sign-in/me')).body.data).toEqual({
      userId: paul.id,
      activeSalonId: null,
    });

    const withOldToken = await browser.agent
      .post('/api/public/auth/sign-out')
      .set('x-csrf-token', visitorToken)
      .send();
    expect(withOldToken.status).toBe(403);
    expect(withOldToken.body.message).toBe(
      'Jeton de sécurité absent ou expiré : rechargez la page puis recommencez.',
    );
    const withNewToken = await browser.agent
      .post('/api/public/auth/sign-out')
      .set('x-csrf-token', res.body.data.csrfToken)
      .send();
    expect(withNewToken.status).toBe(200);
  });

  it('answers a phone number without account, a light client account and a wrong password in exactly the same way', async () => {
    const paul = await staff('Paul Ebode');
    await db.query(
      `INSERT INTO users (id, phone, created_at, version) VALUES ($1, '+237655443322', now(), 1)`,
      [randomUUID()],
    );

    const unknown = await signIn(t.browser(), '6 70 00 00 01');
    const lightClient = await signIn(t.browser(), '6 55 44 33 22');
    const wrong = await signIn(t.browser(), paul.typed, 'Akwa-Fade-2026');

    expect(unknown.status).toBe(422);
    expect(unknown.body).toEqual({
      status: 'ERROR',
      code: 'INVALID_CREDENTIALS',
      message: 'Numéro ou mot de passe incorrect.',
    });
    expect([lightClient.status, lightClient.body]).toEqual([unknown.status, unknown.body]);
    expect([wrong.status, wrong.body]).toEqual([unknown.status, unknown.body]);
    expect(setCookies(wrong).some((c) => c.startsWith('gmc.device='))).toBe(false);
  });

  it('refuses a sign-in without CSRF token and counts no attempt', async () => {
    const paul = await staff('Paul Ebode');

    const res = await t
      .browser()
      .agent.post('/api/public/auth/sign-in')
      .send({ phone: paul.typed, password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Jeton de sécurité absent ou expiré : rechargez la page puis recommencez.');
    expect(await attemptsFor(paul.e164)).toBe(0);
  });

  it('refuses a badly typed phone number or an empty password without counting an attempt', async () => {
    const paul = await staff('Paul Ebode');

    const malformed = await signIn(t.browser(), '6 99 00 11 2');
    const emptyPassword = await signIn(t.browser(), paul.typed, '');
    const tooLong = await signIn(t.browser(), paul.typed, 'x'.repeat(129));

    expect(malformed.status).toBe(422);
    expect(emptyPassword.status).toBe(400);
    expect(emptyPassword.body.errors).toEqual([
      { path: 'password', message: 'Saisissez votre mot de passe.' },
    ]);
    expect(tooLong.status).toBe(400);
    expect(tooLong.body.errors).toEqual([{ path: 'password', message: '128 caractères au plus.' }]);
    expect(await attemptsFor(paul.e164)).toBe(0);
  });

  it('gives no right in any salon right after signing in', async () => {
    const paul = await staff('Paul Ebode');
    const browser = t.browser();
    await signIn(browser, paul.typed);

    const planning = await browser.get('/api/salon/probe-sign-in/planning');

    expect(planning.status).toBe(403);
    expect(planning.body.message).toBe('Choisissez d’abord le salon sur lequel vous travaillez.');
  });

  it('replaces the session already open on the browser, which no longer gives access to anything', async () => {
    const mireille = await staff('Mireille Ndongo');
    const paul = await staff('Paul Ebode');
    const tablet = t.browser();
    const mireilleSession = cookiePair(cookieNamed(await signIn(tablet, mireille.typed), 'gmc.sid'));

    await signIn(tablet, paul.typed);

    expect((await tablet.get('/api/salon/probe-sign-in/me')).body.data.userId).toBe(paul.id);
    const replayed = await t.browser().agent.get('/api/salon/session').set('Cookie', mireilleSession);
    expect(replayed.status).toBe(401);
    expect(replayed.body.message).toBe('Session absente ou expirée : reconnectez-vous.');
  });

  it('destroys the session and clears the session and CSRF cookies on sign-out, keeping the recognised device', async () => {
    const paul = await staff('Paul Ebode');
    const tablet = t.browser();
    const signedIn = await signIn(tablet, paul.typed);
    const session = cookiePair(cookieNamed(signedIn, 'gmc.sid'));

    const res = await signOut(tablet);

    expect(res.status).toBe(200);
    expect(SignedOutSchema.safeParse(res.body.data).success).toBe(true);
    expect(cookieNamed(res, 'gmc.sid')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookieNamed(res, 'gmc.x-csrf')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookieNamed(res, 'gmc.device')).toBeUndefined();
    const replayed = await t.browser().agent.get('/api/salon/session').set('Cookie', session);
    expect(replayed.status).toBe(401);
    expect(
      Number((await db.query(`SELECT count(*) AS n FROM known_devices WHERE user_id = $1`, [paul.id]))[0].n),
    ).toBe(1);
  });

  it('confirms a sign-out even when no session is open, and traces nothing', async () => {
    const audited = async () =>
      Number((await db.query(`SELECT count(*) AS n FROM audit_log WHERE action = 'USER_SIGNED_OUT'`))[0].n);
    const before = await audited();

    const res = await t.browser().post('/api/public/auth/sign-out');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ signedOut: true });
    expect(await audited()).toBe(before);
  });

  it('traces the sign-in and the sign-out without any phone number, password or network address', async () => {
    const paul = await staff('Paul Ebode');
    const browser = t.browser();
    await signIn(browser, paul.typed);
    await signOut(browser);

    const rows = await db.query(
      `SELECT action, subject_id, actor_user_id, details FROM audit_log WHERE actor_user_id = $1 ORDER BY occurred_at, id`,
      [paul.id],
    );

    expect(rows.map((r: { action: string }) => r.action)).toEqual(['USER_SIGNED_IN', 'USER_SIGNED_OUT']);
    expect(rows[0].details).toEqual({ knownDevice: false });
    expect(JSON.stringify(rows)).not.toMatch(new RegExp(`${paul.national}|${PASSWORD}|127\\.0\\.0\\.1|::1`));
  });

  it('ends the session 7 days after the sign-in, even when it is used without interruption', async () => {
    const paul = await staff('Paul Ebode');
    const browser = t.browser();
    await signIn(browser, paul.typed);
    const signedInAt = clock.now();
    const open = async (hoursAfter: number, extraMinutes = 0) => {
      clock.set(new Date(signedInAt.getTime() + hoursAfter * 3_600_000 + extraMinutes * 60_000));
      return browser.get('/api/salon/session');
    };

    expect((await open(167, 59)).status).toBe(200);
    expect((await open(168, 1)).status).toBe(401);
    clock.set(signedInAt);
  });

  it('recognises the browser after a sign-in, even after signing out, and exempts it from the block raised by strangers', async () => {
    const paul = await staff('Paul Ebode');
    const usualPhone = t.browser();
    const firstSignIn = await signIn(usualPhone, paul.typed);
    const deviceCookie = cookieNamed(firstSignIn, 'gmc.device');
    expect(deviceCookie).toMatch(/^gmc\.device=[A-Za-z0-9_-]{43};/);
    expect(deviceCookie).toMatch(/HttpOnly/);
    expect(deviceCookie).toMatch(/SameSite=Lax/);
    expect(deviceCookie).toMatch(/Max-Age=7776000/);
    await signOut(usualPhone);
    const stored = await db.query(`SELECT token_hash FROM known_devices WHERE user_id = $1`, [paul.id]);
    expect(stored[0].token_hash).not.toBe(cookiePair(deviceCookie).split('=')[1]);

    const stranger = t.browser();
    for (let i = 0; i < 5; i++) await signIn(stranger, paul.typed, `Wrong-guess-${i}-ok`);
    const strangerWithRightPassword = await signIn(stranger, paul.typed);
    const usualPhoneAgain = await signIn(usualPhone, paul.typed);

    expect(strangerWithRightPassword.status).toBe(422);
    expect(strangerWithRightPassword.body.code).toBe('SIGN_IN_TEMPORARILY_BLOCKED');
    expect(strangerWithRightPassword.body.message).toBe(
      "Trop d'essais pour ce numéro. Réessayez dans 15 minutes ou utilisez « Mot de passe oublié ».",
    );
    expect(usualPhoneAgain.status).toBe(200);
    const blockTrace = await db.query(
      `SELECT count(*) AS n FROM audit_log WHERE action = 'SIGN_IN_BLOCKED' AND subject_id = $1`,
      [paul.id],
    );
    expect(Number(blockTrace[0].n)).toBe(1);
  });

  const deviceTokensOf = (res: { headers: Record<string, unknown> }) =>
    (/^gmc.device=([^;]*)/.exec(cookieNamed(res, 'gmc.device') ?? '')?.[1] ?? '').split('.').filter(Boolean);
  const wrongTimes = async (typed: string, times: number) => {
    const stranger = t.browser();
    for (let i = 0; i < times; i++) await signIn(stranger, typed, `Wrong-guess-${i}-ok`);
  };
  const borrowing = (deviceTokens: string[]) => {
    const browser = t.browser();
    browser.agent.jar.setCookie(`gmc.device=${deviceTokens.join('.')}`, '127.0.0.1', '/');
    return browser;
  };

  it('recognises each account separately on a shared tablet, with one token per account in the same cookie', async () => {
    const mireille = await staff('Mireille Ndongo');
    const paul = await staff('Paul Ebode');
    const tablet = t.browser();
    await signIn(tablet, mireille.typed);
    await signOut(tablet);
    const paulOnTablet = await signIn(tablet, paul.typed);
    await wrongTimes(mireille.typed, 5);
    await wrongTimes(paul.typed, 5);

    const paulAgain = await signIn(tablet, paul.typed);
    const mireilleAgain = await signIn(tablet, mireille.typed);
    const strangerOnMireille = await signIn(t.browser(), mireille.typed);

    expect(deviceTokensOf(paulOnTablet)).toHaveLength(2);
    expect([paulAgain.status, mireilleAgain.status]).toEqual([200, 200]);
    expect(deviceTokensOf(mireilleAgain)).toHaveLength(2);
    expect(strangerOnMireille.body.code).toBe('SIGN_IN_TEMPORARILY_BLOCKED');
  });

  it('stops recognising a copied device token as soon as its owner signs in again', async () => {
    const mireille = await staff('Mireille Ndongo');
    const tablet = t.browser();
    const first = await signIn(tablet, mireille.typed);
    const copied = deviceTokensOf(first);
    await signOut(tablet);
    await signIn(tablet, mireille.typed);
    await wrongTimes(mireille.typed, 5);

    const withCopiedToken = await signIn(borrowing(copied), mireille.typed);

    expect(withCopiedToken.status).toBe(422);
    expect(withCopiedToken.body.code).toBe('SIGN_IN_TEMPORARILY_BLOCKED');
  });

  it('never takes a token chosen by the client as a device token', async () => {
    const paul = await staff('Paul Ebode');
    const forged = 'a'.repeat(43);

    const res = await signIn(borrowing([forged]), paul.typed);
    await wrongTimes(paul.typed, 5);
    const stillForged = await signIn(borrowing([forged]), paul.typed);

    expect(res.status).toBe(200);
    const stored = await db.query(`SELECT token_hash FROM known_devices WHERE user_id = $1`, [paul.id]);
    expect(stored).toHaveLength(1);
    expect(deviceTokensOf(res)).toContain(forged);
    expect(stored[0].token_hash).not.toBe(forged);
    expect(stillForged.body.code).toBe('SIGN_IN_TEMPORARILY_BLOCKED');
  });

  it('keeps at most 5 device tokens in the cookie of a browser', async () => {
    const tablet = t.browser();
    let last;
    for (let i = 0; i < 6; i++) {
      const account = await staff(`Collaborateur ${i}`);
      last = await signIn(tablet, account.typed);
      await signOut(tablet);
    }

    expect(deviceTokensOf(last!)).toHaveLength(5);
  });
});
