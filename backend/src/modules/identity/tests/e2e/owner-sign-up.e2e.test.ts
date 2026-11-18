import { Controller, Get } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '../../../../shared/application/ports.js';
import {
  AuthenticatedOnly,
  CurrentActor,
  RequiresSystemRole,
} from '../../../../shared/infrastructure/security/decorators.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SMS_SENDER } from '../../domain/ports/sms-sender.port.js';
import { InMemorySmsSender } from '../fakes/identity-fakes.js';

@Controller('salon/probe-identity')
class WhoAmIController {
  @Get('me')
  @AuthenticatedOnly()
  me(@CurrentActor() actor: Actor) {
    return { userId: actor.userId, activeSalonId: actor.activeSalonId };
  }
}

@Controller('admin/probe-identity')
class PlatformAdminController {
  @Get()
  @RequiresSystemRole('SUPER_ADMIN')
  enter() {
    return { ok: true };
  }
}

const PASSWORD = 'Akwa-Tresses-27';
const codeIn = (sms: string | undefined) => sms?.match(/\b(\d{6})\b/)?.[1] ?? '';
const sessionCookie = (res: { headers: Record<string, unknown> }) =>
  ([] as string[])
    .concat((res.headers['set-cookie'] as string[] | undefined) ?? [])
    .find((c) => c.startsWith('gmc.sid='));

describe('A salon owner signs up with a phone number proved by SMS', () => {
  let t: TestApp;
  let sms: InMemorySmsSender;
  let db: DataSource;

  const requestCode = (browser: Browser, phone: string) =>
    browser.post('/api/public/sign-up/code', { phone, acceptedTerms: true });
  const confirm = (browser: Browser, phone: string, code: string, name = 'Mireille Ndongo') =>
    browser.post('/api/public/sign-up', { phone, code, name, password: PASSWORD, acceptedTerms: true });
  const accountsFor = async (e164: string) =>
    Number((await db.query(`SELECT count(*) AS n FROM users WHERE phone = $1`, [e164]))[0].n);

  beforeAll(async () => {
    sms = new InMemorySmsSender();
    t = await startTestApp({
      controllers: [WhoAmIController, PlatformAdminController],
      overrides: [[SMS_SENDER, sms]],
    });
    db = t.moduleRef.get(getDataSourceToken());
  });
  afterAll(() => t.close());

  it('creates the account, opens a fresh session without any role and leads to the organisation step', async () => {
    const browser = t.browser();
    const sent = await requestCode(browser, '6 77 12 34 56');
    expect(sent.status).toBe(202);
    expect(sent.body.data).toEqual({
      maskedPhone: '6 77 •• •• 56',
      expiresInSeconds: 300,
      resendInSeconds: 60,
    });
    const visitorSession =
      sessionCookie(sent) ?? sessionCookie(await browser.get('/api/public/session/csrf'));

    const signedUp = await confirm(browser, '6 77 12 34 56', codeIn(sms.lastTo('+237677123456')));

    expect(signedUp.status).toBe(201);
    expect(signedUp.body.data).toMatchObject({
      nextStep: 'CREATE_ORGANIZATION',
      csrfToken: expect.any(String),
    });
    expect(sessionCookie(signedUp)).toBeDefined();
    expect(sessionCookie(signedUp)).not.toBe(visitorSession);
    expect((await browser.get('/api/salon/probe-identity/me')).body.data).toEqual({
      userId: signedUp.body.data.userId,
      activeSalonId: null,
    });
    expect((await browser.get('/api/admin/probe-identity')).status).toBe(403);
  });

  it('no longer accepts the CSRF token obtained before signing up', async () => {
    const browser = t.browser();
    const oldToken = (await browser.get('/api/public/session/csrf')).body.data.csrfToken as string;
    await browser.agent
      .post('/api/public/sign-up/code')
      .set('x-csrf-token', oldToken)
      .send({ phone: '6 70 00 00 07', acceptedTerms: true });
    await browser.agent
      .post('/api/public/sign-up')
      .set('x-csrf-token', oldToken)
      .send({
        phone: '6 70 00 00 07',
        code: codeIn(sms.lastTo('+237670000007')),
        name: 'Awa Ngono',
        password: PASSWORD,
        acceptedTerms: true,
      });

    const reused = await browser.agent
      .post('/api/public/sign-up/code')
      .set('x-csrf-token', oldToken)
      .send({ phone: '6 70 00 00 08', acceptedTerms: true });

    expect(reused.status).toBe(403);
    expect(reused.body.code).toBe('CSRF_INVALID');
  });

  it('counts every wrong code, attempt after attempt', async () => {
    const browser = t.browser();
    await requestCode(browser, '6 51 00 00 01');

    const first = await confirm(browser, '6 51 00 00 01', '000000');
    const second = await confirm(browser, '6 51 00 00 01', '000001');

    expect([first.status, first.body.message]).toEqual([422, 'Code incorrect. Il vous reste 4 essais.']);
    expect([second.status, second.body.message]).toEqual([422, 'Code incorrect. Il vous reste 3 essais.']);
    expect(await accountsFor('+237651000001')).toBe(0);
  });

  it('answers the same way whether the number already has an account or not', async () => {
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, created_at, version)
       VALUES ('0195f000-0000-7000-8000-00000000a001', '+237699001122', 'Paul Ebode', '$argon2id$test', now(), now(), 1)`,
    );

    const forRegistered = await requestCode(t.browser(), '6 99 00 11 22');
    const forNewNumber = await requestCode(t.browser(), '6 55 44 33 22');

    const comparable = (res: typeof forNewNumber) => ({
      status: res.status,
      data: { ...res.body.data, maskedPhone: '' },
    });
    expect(comparable(forRegistered)).toEqual(comparable(forNewNumber));
    expect(codeIn(sms.lastTo('+237699001122'))).toBe('');
  });

  it('creates a single account when the same code is confirmed twice at the same moment', async () => {
    await requestCode(t.browser(), '6 52 00 00 02');
    const code = codeIn(sms.lastTo('+237652000002'));

    const results = await Promise.all([
      confirm(t.browser(), '6 52 00 00 02', code),
      confirm(t.browser(), '6 52 00 00 02', code),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([201, expect.any(Number)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await accountsFor('+237652000002')).toBe(1);
  });

  it('sends a single SMS when many code requests for the same number arrive at once', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => requestCode(t.browser(), '6 54 00 00 04')),
    );

    expect(results.filter((r) => r.status === 202)).toHaveLength(1);
    expect(sms.sent.filter((s) => s.to === '+237654000004')).toHaveLength(1);
  });

  it('destroys the visitor session once the account is created', async () => {
    const browser = t.browser();
    const visitorCookie = sessionCookie(await browser.get('/api/public/session/csrf'));
    const visitorSid = decodeURIComponent(visitorCookie!.split(';')[0]!.split('=')[1]!)
      .replace(/^s:/, '')
      .replace(/\.[^.]+$/, '');
    await requestCode(browser, '6 56 00 00 06');

    await confirm(browser, '6 56 00 00 06', codeIn(sms.lastTo('+237656000006')));

    expect(
      Number((await db.query(`SELECT count(*) AS n FROM sessions WHERE sid = $1`, [visitorSid]))[0].n),
    ).toBe(0);
  });

  it('lists the fields to correct when the form breaks the contract', async () => {
    const res = await t
      .browser()
      .post('/api/public/sign-up', { phone: '6 77 12 34 56', code: '12', name: 'M', password: PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { path: string }) => e.path).sort()).toEqual([
      'acceptedTerms',
      'code',
      'name',
    ]);
  });
});
