import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Controller, Get, Req } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { Request } from 'express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ACTOR_RIGHTS, type ActorRights, READ_DB } from '../../../../shared/application/ports.js';
import { SseRealtimePublisher } from '../../../../shared/infrastructure/realtime/sse-realtime.publisher.js';
import { AuthenticatedOnly } from '../../../../shared/infrastructure/security/decorators.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SqlActorRights } from '../../application/read-repositories/sql-actor-rights.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { sessionCookieOf, type StaffAccount, StaffAccounts } from '../builders/staff-accounts.js';

/** Consultation longue : lit la session, attend le feu vert du test, puis la modifie (donc la sauve à sa fin). */
const slow = {
  entered: Promise.withResolvers<void>(),
  proceed: Promise.withResolvers<void>(),
  reset() {
    this.entered = Promise.withResolvers<void>();
    this.proceed = Promise.withResolvers<void>();
  },
};

@Controller('salon/probe-slow')
class SlowConsultationController {
  @Get('planning')
  @AuthenticatedOnly()
  async planning(@Req() req: Request) {
    slow.entered.resolve();
    await slow.proceed.promise;
    req.session.lastActivityAt = Date.now();
    return { ok: true };
  }
}

/** Droits réels ; la lecture de la commande pour un salon armé attend le feu vert du test (demande « en vol »). */
const gate = {
  delegate: undefined as unknown as ActorRights,
  salonId: null as string | null,
  entered: Promise.withResolvers<void>(),
  proceed: Promise.withResolvers<void>(),
  arm(salonId: string) {
    this.salonId = salonId;
    this.entered = Promise.withResolvers<void>();
    this.proceed = Promise.withResolvers<void>();
  },
  async resolve(userId: string, salonId: string | null) {
    const rights = await this.delegate.resolve(userId, salonId);
    if (salonId !== null && salonId === this.salonId) {
      this.salonId = null;
      this.entered.resolve();
      await this.proceed.promise;
    }
    return rights;
  },
};

const SELECT = '/api/salon/session/active-salon';
const SESSION = '/api/salon/session';

const eventually = async (check: () => boolean, timeoutMs = 2_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
};

describe('Switching salons while live streams and other requests are open', () => {
  let t: TestApp;
  let db: DataSource;
  let accounts: StaffAccounts;
  let world: SalonWorld;
  let publisher: SseRealtimePublisher;
  let port: number;
  let mireille: StaffAccount;
  let akwa: WorldSalon;
  let bastos: WorldSalon;

  beforeAll(async () => {
    t = await startTestApp({
      controllers: [SlowConsultationController],
      overrides: [[ACTOR_RIGHTS, gate]],
    });
    gate.delegate = new SqlActorRights(t.moduleRef.get(READ_DB));
    db = t.moduleRef.get(getDataSourceToken());
    accounts = new StaffAccounts(db);
    world = new SalonWorld(db);
    publisher = t.moduleRef.get(SseRealtimePublisher);
    await t.app.listen(0);
    port = (t.app.getHttpServer().address() as AddressInfo).port;
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    slow.reset();
    mireille = await accounts.create('Mireille Ndongo');
    [akwa, bastos] = (await world.organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
      { name: 'Go Beauty Bastos', city: 'Yaoundé', district: 'Bastos' },
    ])) as [WorldSalon, WorldSalon];
  });

  const signedIn = async () => {
    const browser = t.browser();
    const res = await accounts.signIn(browser, mireille);
    return { browser, sid: sessionCookieOf(res)! };
  };
  const select = async (browser: Browser, salonId: string) => {
    const res = await browser.post(SELECT, { salonId });
    if (res.status === 200) browser.useCsrfToken(res.body.data.csrfToken);
    return res;
  };
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
  const news = (salonId: string, type: string) => publisher.publishToSalon(salonId, { type, payload: {} });
  const pause = () => new Promise((r) => setTimeout(r, 200));

  it('closes the streams opened with the old session, then follows only the new salon after the reconnection', async () => {
    const { browser, sid } = await signedIn();
    const inAkwa = await select(browser, akwa.id);
    const stream = await openStream(sessionCookieOf(inAkwa)!);
    news(akwa.id, 'AKWA_NEWS_BEFORE');
    await eventually(() => stream.text().includes('AKWA_NEWS_BEFORE'));
    expect(sid).toBeDefined();

    const inBastos = await select(browser, bastos.id);
    await eventually(stream.ended);
    news(akwa.id, 'AKWA_NEWS_AFTER');
    const reopened = await openStream(sessionCookieOf(inBastos)!);
    news(akwa.id, 'AKWA_NEWS_AFTER_RECONNECTION');
    news(bastos.id, 'BASTOS_NEWS');
    await eventually(() => reopened.text().includes('BASTOS_NEWS'));
    await pause();

    const [closedStream, oldSalonSeen, newSalonSeen, oldSalonSeenAfter] = [
      stream.ended(),
      stream.text().includes('AKWA_NEWS_AFTER'),
      reopened.text().includes('BASTOS_NEWS'),
      reopened.text().includes('AKWA_NEWS'),
    ];
    stream.hangUp();
    reopened.hangUp();
    expect([closedStream, oldSalonSeen, newSalonSeen, oldSalonSeenAfter]).toEqual([true, false, true, false]);
  });

  it('leaves the stream of another device of the same user open, on its own salon', async () => {
    const phone = await signedIn();
    const tablet = await signedIn();
    const tabletInAkwa = await select(tablet.browser, akwa.id);
    const phoneInAkwa = await select(phone.browser, akwa.id);
    const tabletStream = await openStream(sessionCookieOf(tabletInAkwa)!);
    const phoneStream = await openStream(sessionCookieOf(phoneInAkwa)!);

    await select(phone.browser, bastos.id);
    await eventually(phoneStream.ended);
    news(akwa.id, 'AKWA_FOR_THE_TABLET');
    await eventually(() => tabletStream.text().includes('AKWA_FOR_THE_TABLET'));

    const result = [
      phoneStream.ended(),
      tabletStream.ended(),
      tabletStream.text().includes('AKWA_FOR_THE_TABLET'),
    ];
    expect((await tablet.browser.get(SESSION)).body.data.activeSalonId).toBe(akwa.id);
    tabletStream.hangUp();
    phoneStream.hangUp();
    expect(result).toEqual([true, false, true]);
  });

  it('never brings back the old session when a request that was running during the change ends', async () => {
    const { browser } = await signedIn();
    const sidOfAkwa = sessionCookieOf(await select(browser, akwa.id))!;
    const running = request(t.app.getHttpServer())
      .get('/api/salon/probe-slow/planning')
      .set('cookie', sidOfAkwa)
      .then((res) => res);
    await slow.entered.promise;

    const inBastos = await select(browser, bastos.id);
    slow.proceed.resolve();
    const finished = await running;

    expect([finished.status, inBastos.status]).toEqual([200, 200]);
    expect((await request(t.app.getHttpServer()).get(SESSION).set('cookie', sidOfAkwa)).status).toBe(401);
    const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM sessions WHERE sess->>'userId' = $1`, [
      mireille.id,
    ]);
    expect(n).toBe(1);
    expect((await browser.get(SESSION)).body.data.activeSalonId).toBe(bastos.id);
  });

  it('ends up with a single active salon, with its rights, after two simultaneous changes', async () => {
    const { browser } = await signedIn();
    await select(browser, akwa.id);

    const results = await Promise.all([
      browser.post(SELECT, { salonId: bastos.id }),
      browser.post(SELECT, { salonId: akwa.id }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM sessions WHERE sess->>'userId' = $1`, [
      mireille.id,
    ]);
    expect(n).toBe(1);
    const summary = await browser.get(SESSION);
    expect([200, 401]).toContain(summary.status);
    expect([akwa.id, bastos.id, undefined]).toContain(summary.body.data?.activeSalonId);
  });

  it('issues no new session when the user signs out while a change of salon is running', async () => {
    const { browser } = await signedIn();
    const sidOfAkwa = sessionCookieOf(await select(browser, akwa.id))!;
    gate.arm(bastos.id);
    const running = browser.post(SELECT, { salonId: bastos.id });
    await gate.entered.promise;

    const signedOut = await browser.post('/api/public/auth/sign-out');
    gate.proceed.resolve();
    const changed = await running;

    expect(signedOut.status).toBe(200);
    expect([changed.status, changed.body.code]).toEqual([401, 'UNAUTHENTICATED']);
    expect((await request(t.app.getHttpServer()).get(SESSION).set('cookie', sidOfAkwa)).status).toBe(401);
    expect((await browser.get(SESSION)).status).toBe(401);
    const [{ n }] = await db.query(`SELECT count(*)::int AS n FROM sessions WHERE sess->>'userId' = $1`, [
      mireille.id,
    ]);
    expect(n).toBe(0);
  });

  it('keeps refusing the regenerated session after the password was reset on another device', async () => {
    const { browser } = await signedIn();
    await select(browser, bastos.id);
    await db.query(`UPDATE users SET credentials_version = credentials_version + 1 WHERE id = $1`, [
      mireille.id,
    ]);

    const res = await browser.get(SESSION);

    expect([res.status, res.body.code]).toEqual([401, 'UNAUTHENTICATED']);
  });
});
