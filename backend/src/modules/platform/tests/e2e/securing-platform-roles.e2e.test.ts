import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CLOCK } from '../../../../shared/application/ports.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SMS_SENDER, type SmsSender } from '../../../identity/domain/ports/sms-sender.port.js';
import { SystemRole } from '../../domain/enums/system-role.enum.js';
import { PlatformWorld, type TestUser } from '../builders/platform-world.js';

const ROLES_URL = '/api/admin/platform-roles';
const SESSION_URL = '/api/salon/session';
const ACTIVE_SALON_URL = '/api/salon/session/active-salon';
const NOW = new Date('2026-11-20T09:00:00.000Z');

describe('Securing platform system roles over HTTP (T16–T19, T21–T22)', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let world: PlatformWorld;
  const sentSms: Array<{ to: string; text: string }> = [];

  let henri: TestUser;
  let nadine: TestUser;
  let serge: TestUser;
  let brice: TestUser;
  let mireille: TestUser;
  let aicha: TestUser;
  let akwaId: string;
  let essosId: string;

  beforeAll(async () => {
    clock = new FixedClock(NOW);
    const fakeSms: SmsSender = {
      send: async (to, text) => {
        sentSms.push({ to: to.value, text });
      },
    };

    t = await startTestApp({
      overrides: [
        [CLOCK, clock],
        [SMS_SENDER, fakeSms],
      ],
    });
    db = t.moduleRef.get(getDataSourceToken());
    world = new PlatformWorld(db);
  });

  afterAll(() => t?.close());

  beforeEach(async () => {
    clock.set(NOW);
    sentSms.length = 0;

    await db.query(`DELETE FROM platform_admin_roles`);
    await db.query(`DELETE FROM audit_log`);
    await db.query(`DELETE FROM sessions`);
    await db.query(`DELETE FROM known_devices`);
    await db.query(`DELETE FROM sign_in_attempts`);
    await db.query(`DELETE FROM otp_challenges`);
    await db.query(`DELETE FROM salon_memberships`);
    await db.query(`DELETE FROM salons`);
    await db.query(`DELETE FROM organizations`);
    await db.query(`DELETE FROM users`);

    henri = await world.createUser({ phone: '6 90 11 22 33', name: 'Henri Ondoa' });
    nadine = await world.createUser({ phone: '6 91 22 33 44', name: 'Nadine Tchatchouang' });
    serge = await world.createUser({ phone: '6 92 33 44 55', name: 'Serge Kamga' });
    brice = await world.createUser({ phone: '6 93 44 55 66', name: 'Brice Mvondo' });
    mireille = await world.createUser({ phone: '6 77 12 34 56', name: 'Mireille Ndongo' });
    aicha = await world.createUser({ phone: '6 55 44 33 22', name: null, hasPassword: false });

    await world.assignSystemRole(henri.id, SystemRole.SUPER_ADMIN, NOW);
    await world.assignSystemRole(serge.id, SystemRole.OPERATIONS_ADMIN, NOW, henri.id);

    akwaId = await world.createSalonWithOwner(mireille.id, 'Go Beauty Akwa', '+237699887766');
    essosId = await world.createSalonWithOwner(serge.id, 'Salon Kamga Essos', '+237699887767');
    await world.addSalonMembership(akwaId, serge.id, 'SALON_ADMIN');
  });

  const openClientSession = async (user: TestUser) => {
    const browser = t.browser();
    const codeRes = await browser.post('/api/public/client/code', { phone: user.typed, termsAccepted: true });
    expect(codeRes.status).toBe(202);
    const sms = sentSms.at(-1);
    const code = sms?.text.match(/\b(\d{6})\b/)?.[1];
    expect(code).toBeDefined();
    const verifyRes = await browser.post('/api/public/client/session', {
      phone: user.typed,
      code,
    });
    expect(verifyRes.status).toBe(200);
    const csrfToken = verifyRes.body.data.csrfToken as string;
    browser.useCsrfToken(csrfToken);
    return { browser, csrfToken };
  };

  it('enforces SUPER_ADMIN access control, CSRF, and rejects CLIENT sessions across GET, POST and DELETE (T16)', async () => {
    const anonymous = t.browser();
    expect((await anonymous.get(ROLES_URL)).status).toBe(401);
    expect((await anonymous.post(ROLES_URL, { phone: brice.typed, role: SystemRole.FINANCE_ADMIN })).status).toBe(401);

    const henriBrowser = t.browser();
    await world.signInStaff(henriBrowser, henri);
    const noCsrf = await henriBrowser.agent
      .post(ROLES_URL)
      .send({ phone: brice.typed, role: SystemRole.FINANCE_ADMIN });
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.code).toBe('CSRF_INVALID');

    await world.assignSystemRole(brice.id, SystemRole.FINANCE_ADMIN, NOW, henri.id);
    for (const user of [serge, brice, mireille]) {
      const b = t.browser();
      const { csrfToken } = await world.signInStaff(b, user);
      const getRes = await b.get(ROLES_URL);
      expect(getRes.status).toBe(403);
      expect(getRes.body.message).toBe('Action réservée à l’équipe GoMeCoiffer.');

      const postRes = await b.post(ROLES_URL, { phone: nadine.typed, role: SystemRole.FINANCE_ADMIN });
      expect(postRes.status).toBe(403);

      const delRes = await world.deleteWithCsrf(b, `${ROLES_URL}/${serge.id}/${SystemRole.OPERATIONS_ADMIN}`, csrfToken);
      expect(delRes.status).toBe(403);
    }

    const { browser: aichaBrowser, csrfToken: aichaCsrf } = await openClientSession(aicha);
    for (const res of [
      await aichaBrowser.get(ROLES_URL),
      await aichaBrowser.post(ROLES_URL, { phone: nadine.typed, role: SystemRole.FINANCE_ADMIN }),
      await world.deleteWithCsrf(aichaBrowser, `${ROLES_URL}/${serge.id}/${SystemRole.OPERATIONS_ADMIN}`, aichaCsrf),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('STAFF_SIGN_IN_REQUIRED');
    }
  });

  it('rejects invalid inputs, salon roles, unknown fields, and malformed path parameters with 400 (T17)', async () => {
    const henriBrowser = t.browser();
    const { csrfToken } = await world.signInStaff(henriBrowser, henri);

    for (const payload of [
      { phone: brice.typed, role: 'OWNER' },
      { phone: brice.typed, role: 'MODERATOR' },
      { phone: '6 93', role: SystemRole.OPERATIONS_ADMIN },
      { phone: brice.typed, role: SystemRole.OPERATIONS_ADMIN, salonId: akwaId },
      { phone: brice.typed, role: SystemRole.OPERATIONS_ADMIN, actorUserId: serge.id },
    ]) {
      const res = await henriBrowser.post(ROLES_URL, payload);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }

    const badUuid = await world.deleteWithCsrf(henriBrowser, `${ROLES_URL}/not-a-uuid/OPERATIONS_ADMIN`, csrfToken);
    expect(badUuid.status).toBe(400);

    const badRole = await world.deleteWithCsrf(henriBrowser, `${ROLES_URL}/${serge.id}/OWNER`, csrfToken);
    expect(badRole.status).toBe(400);
    expect(badRole.body.code).toBe('VALIDATION_FAILED');
  });

  it('returns exact business status codes for unknown phone, light client, self-modification, duplicate, and unassigned role (T18)', async () => {
    const henriBrowser = t.browser();
    const { csrfToken } = await world.signInStaff(henriBrowser, henri);
    await world.assignSystemRole(nadine.id, SystemRole.SUPER_ADMIN, NOW, henri.id);

    const notFound = await henriBrowser.post(ROLES_URL, {
      phone: '6 70 00 00 01',
      role: SystemRole.OPERATIONS_ADMIN,
    });
    expect(notFound.status).toBe(404);

    const lightClient = await henriBrowser.post(ROLES_URL, {
      phone: aicha.typed,
      role: SystemRole.OPERATIONS_ADMIN,
    });
    expect(lightClient.status).toBe(422);
    expect(lightClient.body.code).toBe('STAFF_ACCOUNT_REQUIRED');

    const selfGrant = await henriBrowser.post(ROLES_URL, {
      phone: henri.typed,
      role: SystemRole.FINANCE_ADMIN,
    });
    expect(selfGrant.status).toBe(422);
    expect(selfGrant.body.code).toBe('SELF_SYSTEM_ROLE_MODIFICATION');

    const selfRevoke = await world.deleteWithCsrf(
      henriBrowser,
      `${ROLES_URL}/${henri.id}/${SystemRole.SUPER_ADMIN}`,
      csrfToken,
    );
    expect(selfRevoke.status).toBe(422);
    expect(selfRevoke.body.code).toBe('SELF_SYSTEM_ROLE_MODIFICATION');

    const duplicate = await henriBrowser.post(ROLES_URL, {
      phone: serge.typed,
      role: SystemRole.OPERATIONS_ADMIN,
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('SYSTEM_ROLE_ALREADY_GRANTED');

    const unassigned = await world.deleteWithCsrf(
      henriBrowser,
      `${ROLES_URL}/${serge.id}/${SystemRole.FINANCE_ADMIN}`,
      csrfToken,
    );
    expect(unassigned.status).toBe(404);
  });

  it('handles concurrent POST duplicates, concurrent cross-revocations of the last two SUPER_ADMINs, and concurrent DELETEs cleanly without 500 (T19)', async () => {
    const henriBrowser = t.browser();
    const { csrfToken: henriCsrf } = await world.signInStaff(henriBrowser, henri);

    const [g1, g2] = await Promise.all([
      henriBrowser.post(ROLES_URL, { phone: brice.typed, role: SystemRole.FINANCE_ADMIN }),
      henriBrowser.post(ROLES_URL, { phone: brice.typed, role: SystemRole.FINANCE_ADMIN }),
    ]);
    expect([g1.status, g2.status].sort()).toEqual([201, 409]);
    const grantAudits = await db.query(
      `SELECT id FROM audit_log WHERE subject_id = $1 AND action = 'SYSTEM_ROLE_GRANTED'`,
      [brice.id],
    );
    expect(grantAudits).toHaveLength(1);

    const [d1, d2] = await Promise.all([
      world.deleteWithCsrf(henriBrowser, `${ROLES_URL}/${brice.id}/${SystemRole.FINANCE_ADMIN}`, henriCsrf),
      world.deleteWithCsrf(henriBrowser, `${ROLES_URL}/${brice.id}/${SystemRole.FINANCE_ADMIN}`, henriCsrf),
    ]);
    expect([d1.status, d2.status].sort()).toEqual([200, 404]);

    await world.assignSystemRole(nadine.id, SystemRole.SUPER_ADMIN, NOW, henri.id);
    const nadineBrowser = t.browser();
    const { csrfToken: nadineCsrf } = await world.signInStaff(nadineBrowser, nadine);

    const [r1, r2] = await Promise.all([
      world.deleteWithCsrf(henriBrowser, `${ROLES_URL}/${nadine.id}/${SystemRole.SUPER_ADMIN}`, henriCsrf),
      world.deleteWithCsrf(nadineBrowser, `${ROLES_URL}/${henri.id}/${SystemRole.SUPER_ADMIN}`, nadineCsrf),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);
    const superAdmins = await db.query(`SELECT user_id FROM platform_admin_roles WHERE role = 'SUPER_ADMIN'`);
    expect(superAdmins).toHaveLength(1);
  });

  it('applies D-026 reduced session durations (2h idle / 12h absolute) while holding a system role and restores 24h / 7d after revocation (T21)', async () => {
    const sergeBrowser = t.browser();
    await world.signInStaff(sergeBrowser, serge);

    clock.advanceMinutes(119);
    expect((await sergeBrowser.get(SESSION_URL)).status).toBe(200);

    clock.advanceMinutes(121);
    expect((await sergeBrowser.get(SESSION_URL)).status).toBe(401);

    clock.set(NOW);
    const sergeBrowser2 = t.browser();
    await world.signInStaff(sergeBrowser2, serge);
    for (let h = 0; h < 7; h += 1) {
      clock.advanceMinutes(90);
      expect((await sergeBrowser2.get(SESSION_URL)).status).toBe(200);
    }
    clock.advanceMinutes(100);
    expect((await sergeBrowser2.get(SESSION_URL)).status).toBe(401);

    clock.set(NOW);
    const henriBrowser = t.browser();
    const { csrfToken } = await world.signInStaff(henriBrowser, henri);
    await world.deleteWithCsrf(henriBrowser, `${ROLES_URL}/${serge.id}/${SystemRole.OPERATIONS_ADMIN}`, csrfToken);

    clock.advanceMinutes(5);
    const sergeAfter = t.browser();
    await world.signInStaff(sergeAfter, serge);
    clock.advanceMinutes(175);
    expect((await sergeAfter.get(SESSION_URL)).status).toBe(200);
  });

  it('keeps platform roles and salon memberships strictly separated (T22)', async () => {
    const henriBrowser = t.browser();
    const { csrfToken } = await world.signInStaff(henriBrowser, henri);

    const openAkwa = await henriBrowser.post(ACTIVE_SALON_URL, { salonId: akwaId });
    expect(openAkwa.status).toBe(404);

    const revoke = await world.deleteWithCsrf(
      henriBrowser,
      `${ROLES_URL}/${serge.id}/${SystemRole.OPERATIONS_ADMIN}`,
      csrfToken,
    );
    expect(revoke.status).toBe(200);

    const sergeBrowser = t.browser();
    await world.signInStaff(sergeBrowser, serge);
    const sergeSession = await sergeBrowser.get(SESSION_URL);
    expect(sergeSession.status).toBe(200);
    expect(sergeSession.body.data.systemRoles).toEqual([]);
    expect(sergeSession.body.data.nextStep).toBe('CHOOSE_SALON');
    expect(
      (sergeSession.body.data.salons as Array<{ id: string; role: string }>).map((s) => ({
        id: s.id,
        role: s.role,
      })),
    ).toEqual([
      { id: akwaId, role: 'SALON_ADMIN' },
      { id: essosId, role: 'OWNER' },
    ]);
  });
});

