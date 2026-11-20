import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  PlatformAdminsSchema,
  SystemRoleGrantedSchema,
  SystemRoleRevokedSchema,
} from '@gomecoiffer/contracts';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  CLOCK,
  REALTIME_PUBLISHER,
  type RealtimeMessage,
  type RealtimePublisher,
} from '../../../../shared/application/ports.js';
import { SseRealtimePublisher } from '../../../../shared/infrastructure/realtime/sse-realtime.publisher.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SystemRole } from '../../domain/enums/system-role.enum.js';
import {
  PLATFORM_ADMIN_REPOSITORY,
  type PlatformAdminRepository,
} from '../../domain/repositories/write/platform-admin.repository.js';
import { PlatformWorld, type TestUser } from '../builders/platform-world.js';

const ROLES_URL = '/api/admin/platform-roles';
const SESSION_URL = '/api/salon/session';
const NOW = new Date('2026-11-20T09:00:00.000Z');

const eventually = async (check: () => boolean, timeoutMs = 2_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
};

describe('Managing platform system roles over HTTP (T13–T15, T20)', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let world: PlatformWorld;
  let ssePublisher: SseRealtimePublisher;
  let port: number;
  let realtimeOutage = false;
  let saveFailureOnce = false;

  let henri: TestUser;
  let serge: TestUser;
  let brice: TestUser;
  let mireille: TestUser;
  let aicha: TestUser;

  beforeAll(async () => {
    clock = new FixedClock(NOW);
    const realtimeProxy: RealtimePublisher = {
      publishToUser: (userId, message) => ssePublisher.publishToUser(userId, message),
      publishToSalon: (salonId, message: RealtimeMessage) => ssePublisher.publishToSalon(salonId, message),
      closeStreamsOfUser: (userId) => {
        if (realtimeOutage) throw new Error('realtime down');
        ssePublisher.closeStreamsOfUser(userId);
      },
      closeStreamsOfSession: (sessionId) => ssePublisher.closeStreamsOfSession(sessionId),
      closeUserStreamsInSalon: (userId, salonId) => ssePublisher.closeUserStreamsInSalon(userId, salonId),
    };

    t = await startTestApp({
      overrides: [
        [CLOCK, clock],
        [REALTIME_PUBLISHER, realtimeProxy],
      ],
    });
    ssePublisher = t.moduleRef.get(SseRealtimePublisher);
    db = t.moduleRef.get(getDataSourceToken());
    world = new PlatformWorld(db);

    const repo = t.moduleRef.get<PlatformAdminRepository>(PLATFORM_ADMIN_REPOSITORY);
    const originalSave = repo.save.bind(repo);
    repo.save = async (admin) => {
      if (saveFailureOnce) {
        saveFailureOnce = false;
        throw new Error('simulated postgres failure');
      }
      return originalSave(admin);
    };

    await t.app.listen(0);
    port = (t.app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(() => t?.close());

  beforeEach(async () => {
    clock.set(NOW);
    realtimeOutage = false;
    saveFailureOnce = false;

    await db.query(`DELETE FROM platform_admin_roles`);
    await db.query(`DELETE FROM audit_log`);
    await db.query(`DELETE FROM sessions`);
    await db.query(`DELETE FROM known_devices`);
    await db.query(`DELETE FROM sign_in_attempts`);
    await db.query(`DELETE FROM salon_memberships`);
    await db.query(`DELETE FROM salons`);
    await db.query(`DELETE FROM organizations`);
    await db.query(`DELETE FROM users`);

    henri = await world.createUser({ phone: '6 90 11 22 33', name: 'Henri Ondoa' });
    serge = await world.createUser({ phone: '6 92 33 44 55', name: 'Serge Kamga' });
    brice = await world.createUser({ phone: '6 93 44 55 66', name: 'Brice Mvondo' });
    mireille = await world.createUser({ phone: '6 77 12 34 56', name: 'Mireille Ndongo' });
    aicha = await world.createUser({ phone: '6 55 44 33 22', name: null, hasPassword: false });

    await world.assignSystemRole(henri.id, SystemRole.SUPER_ADMIN, NOW);
    await world.assignSystemRole(serge.id, SystemRole.OPERATIONS_ADMIN, NOW, henri.id);
  });

  it('grants a system role, reflects it immediately in GetMySession with PLATFORM_ADMIN nextStep, and supports role accumulation (T13)', async () => {
    const henriBrowser = t.browser();
    await world.signInStaff(henriBrowser, henri);

    const briceBrowser = t.browser();
    await world.signInStaff(briceBrowser, brice);

    const grantRes = await henriBrowser.post(ROLES_URL, {
      phone: brice.typed,
      role: SystemRole.FINANCE_ADMIN,
    });
    expect(grantRes.status).toBe(201);
    expect(SystemRoleGrantedSchema.parse(grantRes.body.data)).toEqual({
      userId: brice.id,
      role: SystemRole.FINANCE_ADMIN,
      grantedAt: NOW.toISOString(),
    });

    const briceSession = await briceBrowser.get(SESSION_URL);
    expect(briceSession.status).toBe(200);
    expect(briceSession.body.data.systemRoles).toEqual([SystemRole.FINANCE_ADMIN]);
    expect(briceSession.body.data.nextStep).toBe('PLATFORM_ADMIN');

    clock.advanceMinutes(1);
    const accumulateRes = await henriBrowser.post(ROLES_URL, {
      phone: serge.typed,
      role: SystemRole.FINANCE_ADMIN,
    });
    expect(accumulateRes.status).toBe(201);

    const sergeBrowser = t.browser();
    await world.signInStaff(sergeBrowser, serge);
    const sergeSession = await sergeBrowser.get(SESSION_URL);
    expect(sergeSession.body.data.systemRoles).toEqual([
      SystemRole.OPERATIONS_ADMIN,
      SystemRole.FINANCE_ADMIN,
    ]);
  });

  it('lists active platform admins sorted with masked phones, superAdminCount, and no non-admin users (T14)', async () => {
    const henriBrowser = t.browser();
    await world.signInStaff(henriBrowser, henri);

    const res = await henriBrowser.get(ROLES_URL);
    expect(res.status).toBe(200);
    const data = PlatformAdminsSchema.parse(res.body.data);
    expect(data.superAdminCount).toBe(1);
    expect(data.admins).toEqual([
      {
        userId: henri.id,
        name: 'Henri Ondoa',
        maskedPhone: '6 •• •• •• 33',
        roles: [{ role: SystemRole.SUPER_ADMIN, grantedAt: NOW.toISOString() }],
      },
      {
        userId: serge.id,
        name: 'Serge Kamga',
        maskedPhone: '6 •• •• •• 55',
        roles: [{ role: SystemRole.OPERATIONS_ADMIN, grantedAt: NOW.toISOString() }],
      },
    ]);

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain(henri.e164);
    expect(serialized).not.toContain(serge.e164);
    expect(serialized).not.toContain(brice.id);
    expect(serialized).not.toContain(mireille.id);
    expect(serialized).not.toContain(aicha.id);
  });

  it('still lists the admins when a stored phone is malformed, hiding it entirely (T14)', async () => {
    const malformed = await world.createUser({ phone: '6 99 88 77 66', name: 'Zoé Mauvais' });
    await db.query(`UPDATE users SET phone = 'abc' WHERE id = $1`, [malformed.id]);
    await world.assignSystemRole(malformed.id, SystemRole.FINANCE_ADMIN, NOW, henri.id);
    const henriBrowser = t.browser();
    await world.signInStaff(henriBrowser, henri);

    const res = await henriBrowser.get(ROLES_URL);

    expect(res.status).toBe(200);
    const listed = PlatformAdminsSchema.parse(res.body.data).admins.find((a) => a.userId === malformed.id);
    expect(listed?.maskedPhone).toBe('•• •• •• ••');
  });

  it('revokes a role, invalidates all target sessions immediately, closes SSE streams, and survives SSE outage (T15)', async () => {
    const henriBrowser = t.browser();
    const { csrfToken: henriCsrf } = await world.signInStaff(henriBrowser, henri);

    const sergeDevice1 = t.browser();
    const { sid: sergeSid } = await world.signInStaff(sergeDevice1, serge);
    const sergeDevice2 = t.browser();
    await world.signInStaff(sergeDevice2, serge);

    let sseClosed = false;
    let sseConnected = false;
    const sseReq = http.get(
      `http://127.0.0.1:${port}/api/salon/realtime/stream`,
      { headers: { Cookie: sergeSid ?? '' } },
      (sseRes) => {
        sseConnected = sseRes.statusCode === 200;
        sseRes.on('data', () => {});
        sseRes.on('end', () => {
          sseClosed = true;
        });
      },
    );
    await eventually(() => sseConnected);
    expect(sseConnected).toBe(true);

    const revokeRes = await world.deleteWithCsrf(
      henriBrowser,
      `${ROLES_URL}/${serge.id}/${SystemRole.OPERATIONS_ADMIN}`,
      henriCsrf,
    );
    expect(revokeRes.status).toBe(200);
    expect(SystemRoleRevokedSchema.parse(revokeRes.body.data)).toEqual({
      userId: serge.id,
      role: SystemRole.OPERATIONS_ADMIN,
      revokedAt: NOW.toISOString(),
    });

    await eventually(() => sseClosed);
    expect(sseClosed).toBe(true);
    sseReq.destroy();

    expect((await sergeDevice1.get(SESSION_URL)).status).toBe(401);
    expect((await sergeDevice2.get(SESSION_URL)).status).toBe(401);

    // Panne SSE lors d'un autre retrait → 200 quand même et sessions invalidées
    await henriBrowser.post(ROLES_URL, { phone: brice.typed, role: SystemRole.FINANCE_ADMIN });
    const briceBrowser = t.browser();
    await world.signInStaff(briceBrowser, brice);
    realtimeOutage = true;

    const revokeBrice = await world.deleteWithCsrf(
      henriBrowser,
      `${ROLES_URL}/${brice.id}/${SystemRole.FINANCE_ADMIN}`,
      henriCsrf,
    );
    expect(revokeBrice.status).toBe(200);
    expect((await briceBrowser.get(SESSION_URL)).status).toBe(401);
  });

  it('writes PII-free audit rows on grant/revoke and writes zero rows on refusal or simulated DB failure (T20)', async () => {
    const henriBrowser = t.browser();
    const { csrfToken } = await world.signInStaff(henriBrowser, henri);

    await henriBrowser.post(ROLES_URL, { phone: brice.typed, role: SystemRole.FINANCE_ADMIN });
    clock.advanceMinutes(5);
    await world.deleteWithCsrf(henriBrowser, `${ROLES_URL}/${brice.id}/${SystemRole.FINANCE_ADMIN}`, csrfToken);

    const rows: Array<{ action: string; subject_id: string; actor_user_id: string; details: unknown }> =
      await db.query(
        `SELECT action, subject_id, actor_user_id, details FROM audit_log WHERE subject_id = $1 ORDER BY occurred_at ASC`,
        [brice.id],
      );
    expect(rows).toEqual([
      {
        action: 'SYSTEM_ROLE_GRANTED',
        subject_id: brice.id,
        actor_user_id: henri.id,
        details: { role: 'FINANCE_ADMIN' },
      },
      {
        action: 'SYSTEM_ROLE_REVOKED',
        subject_id: brice.id,
        actor_user_id: henri.id,
        details: { role: 'FINANCE_ADMIN' },
      },
    ]);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('Brice');
    expect(serialized).not.toContain('Henri');
    expect(serialized).not.toContain(brice.e164);
    expect(serialized).not.toContain(henri.e164);

    saveFailureOnce = true;
    const failed = await henriBrowser.post(ROLES_URL, {
      phone: brice.typed,
      role: SystemRole.FINANCE_ADMIN,
    });
    expect(failed.status).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain('simulated postgres failure');
    const afterFailure = await db.query(`SELECT id FROM audit_log WHERE subject_id = $1`, [brice.id]);
    expect(afterFailure).toHaveLength(2);
  });
});
