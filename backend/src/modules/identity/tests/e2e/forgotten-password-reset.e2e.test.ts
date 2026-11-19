import { randomUUID } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { SignedInSchema, SignUpCodeSentSchema } from '@gomecoiffer/contracts';
import { Controller, Get } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '../../../../shared/application/ports.js';
import { AuthenticatedOnly, CurrentActor } from '../../../../shared/infrastructure/security/decorators.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SMS_SENDER } from '../../domain/ports/sms-sender.port.js';
import { Argon2PasswordVerifier } from '../../infrastructure/crypto/secrets.js';
import { InMemorySmsSender } from '../fakes/identity-fakes.js';

@Controller('salon/probe-reset')
class WhoAmIController {
  @Get('me')
  @AuthenticatedOnly()
  me(@CurrentActor() actor: Actor) {
    return { userId: actor.userId };
  }
}

const OLD_PASSWORD = 'Bastos-Fade-2026';
const NEW_PASSWORD = 'Wouri-Degrade-2027';
const codeIn = (sms: string | undefined) => sms?.match(/\b(\d{6})\b/)?.[1] ?? '';
const cookieNamed = (res: { headers: Record<string, unknown> }, name: string) =>
  ([] as string[])
    .concat((res.headers['set-cookie'] as string[] | undefined) ?? [])
    .find((c) => c.startsWith(`${name}=`));
const cookiePair = (setCookie: string | undefined) => setCookie?.split(';')[0] ?? '';
const eventually = async (condition: () => boolean) => {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((r) => setTimeout(r, 20));
};

describe('A staff member who forgot the password chooses a new one with a code received by SMS', () => {
  let t: TestApp;
  let db: DataSource;
  let sms: InMemorySmsSender;
  let passwordHash: string;
  let nextPhone = 610_000_000;

  async function staff(name = 'Paul Ebode') {
    const national = String(nextPhone++);
    const id = randomUUID();
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, created_at, version)
       VALUES ($1, $2, $3, $4, now(), now(), 1)`,
      [id, `+237${national}`, name, passwordHash],
    );
    const typed = `${national[0]} ${national.slice(1, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
    return { id, e164: `+237${national}`, typed };
  }
  const requestCode = (browser: Browser, typed: string) =>
    browser.post('/api/public/auth/password-reset/code', { phone: typed });
  /** Le code arrive par SMS après la réponse : on attend son arrivée. */
  const receiveCode = async (browser: Browser, person: { typed: string; e164: string }) => {
    const before = sms.sent.length;
    expect((await requestCode(browser, person.typed)).status).toBe(202);
    await eventually(() => sms.sent.length > before);
    return codeIn(sms.lastTo(person.e164));
  };
  const reset = async (browser: Browser, typed: string, code: string, newPassword = NEW_PASSWORD) => {
    const res = await browser.post('/api/public/auth/password-reset', { phone: typed, code, newPassword });
    if (res.status === 200) browser.useCsrfToken(res.body.data.csrfToken);
    return res;
  };
  const signIn = async (browser: Browser, typed: string, password: string) => {
    const res = await browser.post('/api/public/auth/sign-in', { phone: typed, password });
    if (res.status === 200) browser.useCsrfToken(res.body.data.csrfToken);
    return res;
  };
  const whoAmI = (browser: Browser) => browser.get('/api/salon/probe-reset/me');

  beforeAll(async () => {
    sms = new InMemorySmsSender();
    t = await startTestApp({ controllers: [WhoAmIController], overrides: [[SMS_SENDER, sms]] });
    db = t.moduleRef.get(getDataSourceToken());
    passwordHash = await new Argon2PasswordVerifier().rehash(OLD_PASSWORD);
  });
  afterAll(() => t.close());

  it('walks from the request to a new session, a new CSRF token, the new password only', async () => {
    const paul = await staff();
    const browser = t.browser();
    const visit = await browser.get('/api/public/session/csrf');
    const visitorSession = cookiePair(cookieNamed(visit, 'gmc.sid'));
    const visitorToken = visit.body.data.csrfToken as string;

    const asked = await requestCode(browser, paul.typed);
    expect(SignUpCodeSentSchema.safeParse(asked.body.data).success).toBe(true);
    await eventually(() => sms.lastTo(paul.e164) !== undefined);
    const res = await reset(browser, paul.typed, codeIn(sms.lastTo(paul.e164)));

    expect(res.status).toBe(200);
    expect(SignedInSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toMatchObject({
      session: { user: { id: paul.id }, activeSalonId: null, nextStep: 'CREATE_ORGANIZATION' },
    });
    expect(res.body.data.csrfToken).not.toBe(visitorToken);
    expect(cookiePair(cookieNamed(res, 'gmc.sid'))).not.toBe(visitorSession);
    expect(cookieNamed(res, 'gmc.device')).toBeDefined();
    expect((await whoAmI(browser)).body.data).toEqual({ userId: paul.id });
    expect((await signIn(t.browser(), paul.typed, OLD_PASSWORD)).status).toBe(422);
    expect((await signIn(t.browser(), paul.typed, NEW_PASSWORD)).status).toBe(200);
  });

  it('refuses a request without CSRF token, sends nothing and counts nothing', async () => {
    const paul = await staff();
    const before = sms.sent.length;

    const res = await t
      .browser()
      .agent.post('/api/public/auth/password-reset/code')
      .send({ phone: paul.typed });
    await new Promise((r) => setTimeout(r, 100));

    expect(res.status).toBe(403);
    expect(sms.sent.length).toBe(before);
    expect(
      Number((await db.query(`SELECT count(*) AS n FROM otp_challenges WHERE phone = $1`, [paul.e164]))[0].n),
    ).toBe(0);
  });

  it('answers a staff number, a light client number and an unknown number the same way, and refuses their codes the same way', async () => {
    const paul = await staff();
    await db.query(
      `INSERT INTO users (id, phone, created_at, version) VALUES ($1, '+237655443399', now(), 1)`,
      [randomUUID()],
    );
    const people = [paul.typed, '6 55 44 33 99', '6 70 00 99 09'];

    const asked = [];
    for (const typed of people) asked.push(await requestCode(t.browser(), typed));
    const typedCodes = [];
    for (const typed of people)
      typedCodes.push(
        await t
          .browser()
          .post('/api/public/auth/password-reset', {
            phone: typed,
            code: '000000',
            newPassword: NEW_PASSWORD,
          }),
      );

    expect(asked.map((r) => r.status)).toEqual([202, 202, 202]);
    expect(asked.map((r) => ({ ...r.body.data, maskedPhone: '' }))).toEqual([
      { maskedPhone: '', expiresInSeconds: 300, resendInSeconds: 60 },
      { maskedPhone: '', expiresInSeconds: 300, resendInSeconds: 60 },
      { maskedPhone: '', expiresInSeconds: 300, resendInSeconds: 60 },
    ]);
    await new Promise((r) => setTimeout(r, 100));
    expect(sms.sent.filter((s) => ['+237655443399', '+237670009909'].includes(s.to))).toEqual([]);
    expect(typedCodes.map((r) => [r.status, r.body.code, r.body.message])).toEqual([
      [422, 'OTP_INCORRECT', 'Code incorrect. Il vous reste 4 essais.'],
      [422, 'OTP_INCORRECT', 'Code incorrect. Il vous reste 4 essais.'],
      [422, 'OTP_INCORRECT', 'Code incorrect. Il vous reste 4 essais.'],
    ]);
  });

  it('refuses a weak new password without using the code', async () => {
    const paul = await staff();
    const browser = t.browser();
    const code = await receiveCode(browser, paul);

    const weak = await reset(browser, paul.typed, code, 'salon2026');
    const ok = await reset(browser, paul.typed, code);

    expect(weak.status).toBe(422);
    expect(weak.body.code).toBe('PASSWORD_TOO_SHORT');
    expect(ok.status).toBe(200);
  });

  it('counts the wrong code even though the request is refused', async () => {
    const paul = await staff();
    const browser = t.browser();
    await receiveCode(browser, paul);

    await reset(browser, paul.typed, '111111');

    const [row] = await db.query(`SELECT attempts FROM otp_challenges WHERE phone = $1`, [paul.e164]);
    expect(row.attempts).toBe(1);
  });

  it('closes every session of Paul on every device, and nobody else is signed out', async () => {
    const paul = await staff();
    const mireille = await staff('Mireille Ndongo');
    const phone = t.browser();
    const tablet = t.browser();
    const mireilleBrowser = t.browser();
    await signIn(phone, paul.typed, OLD_PASSWORD);
    await signIn(tablet, paul.typed, OLD_PASSWORD);
    await signIn(mireilleBrowser, mireille.typed, OLD_PASSWORD);
    const code = await receiveCode(t.browser(), paul);
    const other = t.browser();

    const res = await reset(other, paul.typed, code);

    expect(res.status).toBe(200);
    expect([(await whoAmI(phone)).status, (await whoAmI(tablet)).status]).toEqual([401, 401]);
    expect((await whoAmI(other)).body.data.userId).toBe(paul.id);
    expect((await whoAmI(mireilleBrowser)).body.data.userId).toBe(mireille.id);
  });

  it('refuses a session rewritten after the reset, as a request in flight would do', async () => {
    const paul = await staff();
    const phone = t.browser();
    await signIn(phone, paul.typed, OLD_PASSWORD);
    const saved = await db.query(`SELECT sid, sess, expire FROM sessions WHERE sess->>'userId' = $1`, [
      paul.id,
    ]);
    const code = await receiveCode(t.browser(), paul);
    await reset(t.browser(), paul.typed, code);

    for (const row of saved)
      await db.query(
        `INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, $3) ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess`,
        [row.sid, JSON.stringify(row.sess), row.expire],
      );

    expect(saved).toHaveLength(1);
    expect((await whoAmI(phone)).status).toBe(401);
  });

  it('replaces the session already open on the browser used for the reset', async () => {
    const paul = await staff();
    const mireille = await staff('Mireille Ndongo');
    const tablet = t.browser();
    await signIn(tablet, mireille.typed, OLD_PASSWORD);
    const code = await receiveCode(t.browser(), paul);

    await reset(tablet, paul.typed, code);

    expect((await whoAmI(tablet)).body.data.userId).toBe(paul.id);
    const mireilleSessions = await db.query(`SELECT 1 FROM sessions WHERE sess->>'userId' = $1`, [mireille.id]);
    expect(mireilleSessions).toHaveLength(0);
  });

  it('lifts the sign-in block of the number', async () => {
    const paul = await staff();
    for (let i = 0; i < 5; i++) await signIn(t.browser(), paul.typed, 'Wrong-guess-1-ok');
    const blocked = await signIn(t.browser(), paul.typed, OLD_PASSWORD);
    expect(blocked.body.code).toBe('SIGN_IN_TEMPORARILY_BLOCKED');
    const code = await receiveCode(t.browser(), paul);

    await reset(t.browser(), paul.typed, code);

    expect((await signIn(t.browser(), paul.typed, NEW_PASSWORD)).status).toBe(200);

  });

  it('forgets the previously recognised devices and recognises the browser of the reset', async () => {
    const paul = await staff();
    await signIn(t.browser(), paul.typed, OLD_PASSWORD);
    const code = await receiveCode(t.browser(), paul);

    await reset(t.browser(), paul.typed, code);

    const devices = await db.query(
      `SELECT revoked_at IS NULL AS recognised FROM known_devices WHERE user_id = $1 ORDER BY recognized_at`,
      [paul.id],
    );
    expect(devices.map((d: { recognised: boolean }) => d.recognised)).toEqual([false, true]);
  });

  it('traces the reset and the sign-in in the audit log, without any secret', async () => {
    const paul = await staff();
    const code = await receiveCode(t.browser(), paul);

    await reset(t.browser(), paul.typed, code);

    const rows = await db.query(
      `SELECT action, details::text AS details FROM audit_log WHERE subject_id = $1 ORDER BY occurred_at, action`,
      [paul.id],
    );
    expect(rows.map((r: { action: string }) => r.action).sort()).toEqual([
      'PASSWORD_RESET',
      'USER_SIGNED_IN',
    ]);
    const trace = JSON.stringify(rows);
    for (const secret of [code, NEW_PASSWORD, paul.e164, '127.0.0.1']) expect(trace).not.toContain(secret);
  });

  it('sends a single SMS when five requests arrive at the same time', async () => {
    const paul = await staff();
    const before = sms.sent.length;

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => requestCode(t.browser(), paul.typed)),
    );
    await eventually(() => sms.sent.length > before);
    await new Promise((r) => setTimeout(r, 100));

    expect(responses.map((r) => r.status).sort()).toEqual([202, 422, 422, 422, 422]);
    expect(
      responses.filter((r) => r.status === 422).every((r) => r.body.code === 'OTP_RESEND_TOO_SOON'),
    ).toBe(true);
    expect(sms.sent.length - before).toBe(1);
  });

  it('lets only one of two simultaneous confirmations of the same code succeed', async () => {
    const paul = await staff();
    const code = await receiveCode(t.browser(), paul);

    const results = await Promise.all([
      reset(t.browser(), paul.typed, code),
      reset(t.browser(), paul.typed, code),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
    expect(results.find((r) => r.status === 422)?.body.code).toBe('OTP_NO_LONGER_VALID');
  });

  it('shows nothing of an SMS provider outage: the refusal of a second request is the same as for an unknown number', async () => {
    const paul = await staff();
    const unknown = { typed: '6 70 00 88 08' };
    sms.outage = true;
    const askedPaul = await requestCode(t.browser(), paul.typed);
    const askedUnknown = await requestCode(t.browser(), unknown.typed);
    await new Promise((r) => setTimeout(r, 200));
    sms.outage = false;

    const againPaul = await requestCode(t.browser(), paul.typed);
    const againUnknown = await requestCode(t.browser(), unknown.typed);

    expect(askedPaul.status).toBe(askedUnknown.status);
    expect([againPaul.status, againPaul.body.code]).toEqual([422, 'OTP_RESEND_TOO_SOON']);
    expect([againUnknown.status, againUnknown.body]).toEqual([againPaul.status, againPaul.body]);
    expect(sms.lastTo(paul.e164)).toBeUndefined();
  });

  it('closes the realtime stream Paul had open before the reset, and leaves the streams of others open', async () => {
    const paul = await staff();
    const mireille = await staff('Mireille Ndongo');
    const openStream = (cookie: string) =>
      new Promise<{ ended: () => boolean; hangUp: () => void }>((resolve, reject) => {
        let ended = false;
        const request = http
          .get({ host: '127.0.0.1', port, path: '/api/salon/realtime/stream', headers: { cookie } }, (res) => {
            res.resume();
            res.on('end', () => (ended = true));
            res.on('close', () => (ended = true));
            expect(res.statusCode).toBe(200);
            resolve({ ended: () => ended, hangUp: () => request.destroy() });
          })
          .on('error', reject);
      });
    await t.app.listen(0);
    const port = (t.app.getHttpServer().address() as AddressInfo).port;
    const cookieOf = async (person: { typed: string }) =>
      cookiePair(cookieNamed(await signIn(t.browser(), person.typed, OLD_PASSWORD), 'gmc.sid'));
    const pauls = await openStream(await cookieOf(paul));
    const mireilles = await openStream(await cookieOf(mireille));
    const code = await receiveCode(t.browser(), paul);

    await reset(t.browser(), paul.typed, code);
    await eventually(pauls.ended);
    await new Promise((r) => setTimeout(r, 200));

    const closed = [pauls.ended(), mireilles.ended()];
    pauls.hangUp();
    mireilles.hangUp();
    expect(closed).toEqual([true, false]);
  });

  // En dernier : les 30 échecs insérés bloquent l'adresse réseau de tous les essais suivants de ce fichier.
  it('keeps the block of the network address, which concerns other numbers', async () => {
    const mireille = await staff('Mireille Ndongo');
    for (let i = 0; i < 30; i++)
      await db.query(
        `INSERT INTO sign_in_attempts (id, phone, network_address, attempted_at, succeeded, from_known_device)
         VALUES ($1, $2, '127.0.0.1', now(), false, false)`,
        [randomUUID(), `+2376990000${String(i).padStart(2, '0')}`],
      );
    const code = await receiveCode(t.browser(), mireille);
    await reset(t.browser(), mireille.typed, code);
    const fromBlockedNetwork = await signIn(t.browser(), mireille.typed, NEW_PASSWORD);
    expect(fromBlockedNetwork.body.message).toMatch(/^Trop d'essais depuis ce réseau/);
  });
});
