import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  ADJUSTABLE_PERMISSIONS,
  RolePermissionsAdjustedSchema,
  SalonRolesSchema,
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
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { RESERVED_OWNER_RIGHTS, SALON_PERMISSIONS } from '../../domain/enums/permission.enum.js';
import {
  ROLE_PERMISSIONS_REPOSITORY,
  type RolePermissionsRepository,
} from '../../domain/repositories/write/role-permissions.repository.js';
import { defaultPermissionsOf } from '../../domain/value-objects/role-permission-set.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { sessionCookieOf, type StaffAccount, StaffAccounts } from '../builders/staff-accounts.js';

const ROLES_URL = '/api/salon/roles';
const SELECT_URL = '/api/salon/session/active-salon';
const SESSION_URL = '/api/salon/session';
const NOW = new Date('2026-11-20T09:00:00.000Z');

const eventually = async (check: () => boolean, timeoutMs = 2_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
};

describe('Adjusting salon role permissions over HTTP (T16–T22, T25–T27)', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let accounts: StaffAccounts;
  let world: SalonWorld;
  let ssePublisher: SseRealtimePublisher;
  let port: number;
  let realtimeOutage = false;
  let saveFailureOnce = false;

  let mireille: StaffAccount;
  let rodrigue: StaffAccount;
  let awa: StaffAccount;
  let hortense: StaffAccount;
  let grace: StaffAccount;
  let akwa: WorldSalon;
  let bastos: WorldSalon;

  beforeAll(async () => {
    clock = new FixedClock(NOW);
    const realtimeProxy: RealtimePublisher = {
      publishToUser: (userId, message) => ssePublisher.publishToUser(userId, message),
      publishToSalon: (salonId, message: RealtimeMessage) => {
        if (realtimeOutage) throw new Error('realtime down');
        ssePublisher.publishToSalon(salonId, message);
      },
      closeStreamsOfUser: (userId) => ssePublisher.closeStreamsOfUser(userId),
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
    accounts = new StaffAccounts(db);
    world = new SalonWorld(db);

    const repo = t.moduleRef.get<RolePermissionsRepository>(ROLE_PERMISSIONS_REPOSITORY);
    const originalSave = repo.save.bind(repo);
    repo.save = async (setting) => {
      if (saveFailureOnce) {
        saveFailureOnce = false;
        throw new Error('simulated postgres failure');
      }
      return originalSave(setting);
    };

    await t.app.listen(0);
    port = (t.app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(() => t?.close());

  beforeEach(async () => {
    clock.set(NOW);
    realtimeOutage = false;
    saveFailureOnce = false;

    mireille = await accounts.create('Mireille Ndongo');
    rodrigue = await accounts.create('Rodrigue Etoa');
    awa = await accounts.create('Awa Tchoua');
    hortense = await accounts.create('Hortense Mballa');
    grace = await accounts.create('Grâce Mbarga');

    [akwa, bastos] = (await world.organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
      { name: 'Go Beauty Bastos', city: 'Yaoundé', district: 'Bastos' },
    ])) as [WorldSalon, WorldSalon];
    await world.membership(akwa.id, rodrigue.id, 'SALON_ADMIN');
    await world.membership(bastos.id, rodrigue.id, 'SALON_ADMIN');
    await world.membership(akwa.id, awa.id, 'HAIRDRESSER');
    await world.membership(akwa.id, hortense.id, 'FINANCE_MANAGER');
    await world.membership(akwa.id, grace.id, 'PRACTITIONER');
  });

  const openSalon = async (person: StaffAccount, salonId: string) => {
    const browser = t.browser();
    await accounts.signIn(browser, person);
    const selected = await browser.post(SELECT_URL, { salonId });
    const csrfToken = selected.body.data.csrfToken as string;
    const sid = sessionCookieOf(selected)!;
    browser.useCsrfToken(csrfToken);
    return { browser, csrfToken, sid };
  };

  const putRole = (browser: Browser, csrfToken: string, role: string, body: object) =>
    browser.agent.put(`${ROLES_URL}/${role}/permissions`).set('x-csrf-token', csrfToken).send(body);

  it('T16 — updates role permissions, applies immediately to Rodrigue without re-sign-in, and does not rotate Mireille session', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const admin = await openSalon(rodrigue, akwa.id);
    const next = [
      ...defaultPermissionsOf('SALON_ADMIN'),
      'finances:view',
      'finances:record-payment',
      'finances:export',
    ];

    const res = await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
      permissions: next,
      version: 1,
    });

    expect(res.status).toBe(200);
    const parsed = RolePermissionsAdjustedSchema.parse(res.body.data);
    expect(parsed.role).toBe('SALON_ADMIN');
    expect(parsed.version).toBe(2);
    expect(parsed.permissions).toContain('finances:view');
    expect(parsed.permissions).toContain('finances:record-payment');
    expect(parsed.permissions).toContain('finances:export');
    // Session de Mireille non régénérée : même identifiant de session (rolling peut renvoyer le même cookie).
    expect(sessionCookieOf(res) ?? owner.sid).toBe(owner.sid);

    const adminSession = await admin.browser.get(SESSION_URL);
    expect(adminSession.status).toBe(200);
    expect(adminSession.body.data.permissions).toContain('finances:view');
    expect(adminSession.body.data.permissions).toContain('finances:export');
  });

  it('T17 — refuses invalid roles, unknown/reserved/duplicate permissions, extra keys and missing version with 400', async () => {
    const owner = await openSalon(mireille, akwa.id);

    for (const invalidRole of ['OWNER', 'SUPER_ADMIN', 'ESTHETICIAN']) {
      const res = await putRole(owner.browser, owner.csrfToken, invalidRole, {
        permissions: ['bookings:view-own'],
        version: 1,
      });
      expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_FAILED']);
    }

    const invalidBodies: object[] = [
      { permissions: ['bookings:delete'], version: 1 },
      { permissions: ['roles:administer'], version: 1 },
      { permissions: ['organization:manage-salons'], version: 1 },
      { permissions: ['subscription:manage'], version: 1 },
      { permissions: ['payout-accounts:manage'], version: 1 },
      { permissions: ['bookings:view-own', 'bookings:view-own'], version: 1 },
      { permissions: ['bookings:view-own'], version: 1, salonId: bastos.id },
      { permissions: ['bookings:view-own'], version: 1, userId: awa.id },
      { permissions: ['bookings:view-own'] },
    ];
    for (const body of invalidBodies) {
      const res = await putRole(owner.browser, owner.csrfToken, 'HAIRDRESSER', body);
      expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_FAILED']);
    }

    const roles = await owner.browser.get(ROLES_URL);
    const hairdresser = roles.body.data.roles.find((r: { role: string }) => r.role === 'HAIRDRESSER');
    expect(hairdresser.permissions).toEqual(defaultPermissionsOf('HAIRDRESSER'));
    expect(hairdresser.version).toBe(1);
  });

  it('T18 — refuses every action permission missing its module view permission with 422 PERMISSION_REQUIRES_VIEW', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const cases: Array<[string, string, string]> = [
      ['finances:export', 'Finances : exporter', 'Finances : consulter'],
      ['finances:record-payment', 'Finances : déclarer un encaissement', 'Finances : consulter'],
      ['bookings:manage', 'Réservations : gérer', 'Réservations : voir toutes'],
      ['services:manage', 'Prestations : gérer', 'Prestations : consulter'],
      ['staff:invite', 'Personnel : inviter', 'Personnel : consulter'],
      ['staff:manage', 'Personnel : gérer', 'Personnel : consulter'],
      ['salon-settings:edit', 'Paramètres salon : modifier', 'Paramètres salon : consulter'],
    ];

    for (const [action, actionLabel, viewLabel] of cases) {
      const res = await putRole(owner.browser, owner.csrfToken, 'FINANCE_MANAGER', {
        permissions: [action],
        version: 1,
      });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('PERMISSION_REQUIRES_VIEW');
      expect(res.body.message).toBe(`Pour donner « ${actionLabel} », donnez aussi « ${viewLabel} ».`);
    }
  });

  it('T19 — enforces auth, CSRF, active salon, and owner-only access even when SALON_ADMIN has all 16 adjustable permissions', async () => {
    // Sans session → 401 (avec jeton CSRF public pour passer CsrfGuard et vérifier AuthGuard)
    const anonymous = t.browser();
    const publicCsrf = (await anonymous.get('/api/public/session/csrf')).body.data.csrfToken as string;
    const unauth = await putRole(anonymous, publicCsrf, 'SALON_ADMIN', {
      permissions: [],
      version: 1,
    });
    expect([unauth.status, unauth.body.code]).toEqual([401, 'UNAUTHENTICATED']);

    // Sans CSRF → 403
    const owner = await openSalon(mireille, akwa.id);
    const noCsrf = await owner.browser.agent
      .put(`${ROLES_URL}/SALON_ADMIN/permissions`)
      .send({ permissions: [], version: 1 });
    expect([noCsrf.status, noCsrf.body.code]).toEqual([403, 'CSRF_INVALID']);

    // Sans salon actif → 403
    const withoutSalon = t.browser();
    const signedIn = await accounts.signIn(withoutSalon, mireille);
    const noSalon = await putRole(withoutSalon, signedIn.body.data.csrfToken, 'SALON_ADMIN', {
      permissions: [],
      version: 1,
    });
    expect(noSalon.status).toBe(403);
    expect(noSalon.body.message).toBe('Choisissez d’abord le salon sur lequel vous travaillez.');

    // Rodrigue, Awa, Hortense → 403
    for (const collaborator of [rodrigue, awa, hortense]) {
      const opened = await openSalon(collaborator, akwa.id);
      const refusedPut = await putRole(opened.browser, opened.csrfToken, 'SALON_ADMIN', {
        permissions: [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view'],
        version: 1,
      });
      expect(refusedPut.status).toBe(403);
      expect(refusedPut.body.message).toBe(
        'Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire.',
      );
    }

    // Même avec les 16 permissions ajustables, Rodrigue ne peut ni consulter ni modifier /api/salon/roles
    const grantedAll = await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
      permissions: [...ADJUSTABLE_PERMISSIONS],
      version: 1,
    });
    expect(grantedAll.status).toBe(200);

    const admin = await openSalon(rodrigue, akwa.id);
    expect((await admin.browser.get(ROLES_URL)).status).toBe(403);
    expect(
      (
        await putRole(admin.browser, admin.csrfToken, 'HAIRDRESSER', {
          permissions: [],
          version: 1,
        })
      ).status,
    ).toBe(403);
  });

  it('T20 — rejects stale version with 409, lets only one of two parallel writes on same role win, and lets two different roles succeed in parallel', async () => {
    const owner = await openSalon(mireille, akwa.id);

    // Version périmée
    const first = await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
      permissions: [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view'],
      version: 1,
    });
    expect(first.status).toBe(200);

    const stale = await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
      permissions: defaultPermissionsOf('SALON_ADMIN').filter((p) => p !== 'staff:invite'),
      version: 1,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.code).toBe('ROLE_PERMISSIONS_CHANGED_MEANWHILE');

    // Deux PUT parallèles sur le même rôle (version 2)
    const [a, b] = await Promise.all([
      putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
        permissions: [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view', 'finances:export'],
        version: 2,
      }),
      putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
        permissions: [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view', 'finances:record-payment'],
        version: 2,
      }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);

    const auditCount = await db.query(
      `SELECT count(*)::int AS n FROM audit_log WHERE salon_id = $1 AND action = 'ROLE_PERMISSIONS_ADJUSTED'`,
      [akwa.id],
    );
    expect(auditCount[0].n).toBe(2); // 1 pour `first` + 1 seul pour la paire parallèle

    // Deux PUT parallèles sur deux rôles différents
    const [r1, r2] = await Promise.all([
      putRole(owner.browser, owner.csrfToken, 'HAIRDRESSER', {
        permissions: ['bookings:view-own'],
        version: 1,
      }),
      putRole(owner.browser, owner.csrfToken, 'FINANCE_MANAGER', {
        permissions: ['dashboard:view', 'bookings:view-all', 'finances:view'],
        version: 1,
      }),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);
  });

  it('T21 — isolates role permissions strictly by active salon (Bastos vs Akwa)', async () => {
    const ownerInBastos = await openSalon(mireille, bastos.id);
    const res = await putRole(ownerInBastos.browser, ownerInBastos.csrfToken, 'SALON_ADMIN', {
      permissions: [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view'],
      version: 1,
    });
    expect(res.status).toBe(200);

    const rodrigueBastos = await openSalon(rodrigue, bastos.id);
    const rodrigueAkwa = await openSalon(rodrigue, akwa.id);

    expect((await rodrigueBastos.browser.get(SESSION_URL)).body.data.permissions).toContain('finances:view');
    expect((await rodrigueAkwa.browser.get(SESSION_URL)).body.data.permissions).not.toContain(
      'finances:view',
    );
  });

  it('T22 — GET /api/salon/roles returns owner, 4 roles in canonical order, member counts without names, and supports empty role permissions', async () => {
    const owner = await openSalon(mireille, akwa.id);
    await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
      permissions: [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view'],
      version: 1,
    });
    // Vide toutes les permissions du Praticien : Grâce ouvre toujours le salon sans module (RG-008-09).
    const emptied = await putRole(owner.browser, owner.csrfToken, 'PRACTITIONER', {
      permissions: [],
      version: 1,
    });
    expect(emptied.status).toBe(200);

    const res = await owner.browser.get(ROLES_URL);
    expect(res.status).toBe(200);
    const data = SalonRolesSchema.parse(res.body.data);

    expect(data.owner).toEqual({
      permissions: [...SALON_PERMISSIONS],
      reservedRights: [...RESERVED_OWNER_RIGHTS],
      members: 1,
    });
    expect(data.roles.map((r) => ({ role: r.role, isDefault: r.isDefault, members: r.members }))).toEqual([
      { role: 'SALON_ADMIN', isDefault: false, members: 1 },
      { role: 'HAIRDRESSER', isDefault: true, members: 1 },
      { role: 'FINANCE_MANAGER', isDefault: true, members: 1 },
      { role: 'PRACTITIONER', isDefault: false, members: 1 },
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/Mireille|Rodrigue|Awa|Hortense|Grâce|\+237/);

    const graceSession = await openSalon(grace, akwa.id);
    const summary = await graceSession.browser.get(SESSION_URL);
    expect(summary.status).toBe(200);
    expect(summary.body.data.activeSalonId).toBe(akwa.id);
    expect(summary.body.data.permissions).toEqual([]);
  });

  it('T25 — records audit entries for changes and resets without personal data, and records nothing on no-op', async () => {
    const owner = await openSalon(mireille, akwa.id);

    // No-op : même liste → version inchangée, aucune ligne d'audit
    const noop = await putRole(owner.browser, owner.csrfToken, 'HAIRDRESSER', {
      permissions: ['availability:edit-own', 'bookings:view-own'],
      version: 1,
    });
    expect(noop.status).toBe(200);
    expect(noop.body.data.version).toBe(1);

    // Modification : +finances:view, -staff:invite
    const changed = await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
      permissions: defaultPermissionsOf('SALON_ADMIN')
        .filter((p) => p !== 'staff:invite')
        .concat('finances:view'),
      version: 1,
    });
    expect(changed.status).toBe(200);

    // Rétablissement par défaut
    const reset = await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
      permissions: [...defaultPermissionsOf('SALON_ADMIN')],
      version: 2,
      resetToDefault: true,
    });
    expect(reset.status).toBe(200);

    const rows = await db.query(
      `SELECT action, subject_type, actor_user_id, salon_id, details
       FROM audit_log
       WHERE salon_id = $1 AND action = 'ROLE_PERMISSIONS_ADJUSTED'
       ORDER BY id ASC`,
      [akwa.id],
    );
    expect(rows).toEqual([
      {
        action: 'ROLE_PERMISSIONS_ADJUSTED',
        subject_type: 'salon_role_permissions',
        actor_user_id: mireille.id,
        salon_id: akwa.id,
        details: {
          role: 'SALON_ADMIN',
          added: 'finances:view',
          removed: 'staff:invite',
          resetToDefault: false,
        },
      },
      {
        action: 'ROLE_PERMISSIONS_ADJUSTED',
        subject_type: 'salon_role_permissions',
        actor_user_id: mireille.id,
        salon_id: akwa.id,
        details: {
          role: 'SALON_ADMIN',
          added: 'staff:invite',
          removed: 'finances:view',
          resetToDefault: true,
        },
      },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/Mireille|Rodrigue|\+237/);
  });

  it('T26 — notifies open SSE salon streams without personal data, and keeps the adjustment when realtime fails', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const admin = await openSalon(rodrigue, akwa.id);

    const chunks: string[] = [];
    const connected = Promise.withResolvers<void>();
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/salon/realtime/stream',
        headers: { cookie: admin.sid, accept: 'text/event-stream' },
      },
      (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => chunks.push(chunk));
        if (res.statusCode === 200) connected.resolve();
      },
    );

    try {
      await connected.promise;
      // Laisse la souscription RxJS se brancher avant l'émission.
      await new Promise((r) => setTimeout(r, 50));
      const res = await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
        permissions: [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view'],
        version: 1,
      });
      expect(res.status).toBe(200);

      await eventually(() => chunks.join('').includes('salon.role_permissions_changed'));
      const streamText = chunks.join('');
      expect(streamText).toContain('salon.role_permissions_changed');
      expect(streamText).toContain('"role":"SALON_ADMIN"');
      expect(streamText).not.toContain('finances:view');
      expect(streamText).not.toMatch(/Mireille|Rodrigue|\+237/);
    } finally {
      req.destroy();
    }

    // Panne du suivi en direct : l'enregistrement réussit (200) et prend effet à la requête suivante.
    realtimeOutage = true;
    const duringOutage = await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
      permissions: [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view', 'finances:export'],
      version: 2,
    });
    expect(duringOutage.status).toBe(200);
    expect((await admin.browser.get(SESSION_URL)).body.data.permissions).toContain('finances:export');
  });

  it('T27 — returns 500 without technical details on persistence failure, leaves state unchanged, and lets a retry succeed', async () => {
    const owner = await openSalon(mireille, akwa.id);
    saveFailureOnce = true;

    const failed = await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
      permissions: [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view'],
      version: 1,
    });
    expect(failed.status).toBe(500);
    expect(JSON.stringify(failed.body)).not.toMatch(/postgres|simulated/i);

    const retry = await putRole(owner.browser, owner.csrfToken, 'SALON_ADMIN', {
      permissions: [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view'],
      version: 1,
    });
    expect(retry.status).toBe(200);
    expect(retry.body.data.version).toBe(2);
  });
});
