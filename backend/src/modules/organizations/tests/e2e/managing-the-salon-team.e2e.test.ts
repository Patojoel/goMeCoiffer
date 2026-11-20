import http from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CollaboratorRemovedSchema,
  CollaboratorRoleChangedSchema,
  InvitationAcceptedSchema,
  SalonTeamSchema,
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
import { SMS_SENDER } from '../../../identity/domain/ports/sms-sender.port.js';
import { InMemorySmsSender } from '../../../identity/tests/fakes/identity-fakes.js';
import {
  SALON_MEMBERSHIP_REPOSITORY,
  type SalonMembershipRepository,
} from '../../domain/repositories/write/salon-membership.repository.js';
import { defaultPermissionsOf } from '../../domain/value-objects/role-permission-set.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { sessionCookieOf, type StaffAccount, StaffAccounts } from '../builders/staff-accounts.js';

const TEAM_URL = '/api/salon/team';
const ROLES_URL = '/api/salon/roles';
const INVITATIONS_URL = '/api/salon/invitations';
const SELECT_URL = '/api/salon/session/active-salon';
const SESSION_URL = '/api/salon/session';
const UNKNOWN_ID = '0195f000-0000-7000-8000-00000000dead';

/** Loin dans le futur : le cookie de preuve SMS expire à l'horloge fixe. */
const NOW = new Date('2031-11-20T09:00:00.000Z');

const eventually = async (check: () => boolean, timeoutMs = 2_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!check() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
};

const codeIn = (text: string | undefined) => text?.match(/\b(\d{6})\b/)?.[1] ?? '';

describe('Managing the salon team over HTTP (T12–T21)', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let sms: InMemorySmsSender;
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
  let clarisse: StaffAccount;
  let paul: StaffAccount;
  let akwa: WorldSalon;
  let bastos: WorldSalon;
  let elegance: WorldSalon;

  const membershipIdOf = async (salonId: string, userId: string): Promise<string> => {
    const rows = await db.query(`SELECT id FROM salon_memberships WHERE salon_id = $1 AND user_id = $2`, [
      salonId,
      userId,
    ]);
    return rows[0].id as string;
  };

  beforeAll(async () => {
    clock = new FixedClock(NOW);
    sms = new InMemorySmsSender();
    const realtimeProxy: RealtimePublisher = {
      publishToUser: (userId, message) => ssePublisher.publishToUser(userId, message),
      publishToSalon: (salonId, message: RealtimeMessage) => {
        if (realtimeOutage) throw new Error('realtime down');
        ssePublisher.publishToSalon(salonId, message);
      },
      closeStreamsOfUser: (userId) => ssePublisher.closeStreamsOfUser(userId),
      closeStreamsOfSession: (sessionId) => ssePublisher.closeStreamsOfSession(sessionId),
      closeUserStreamsInSalon: (userId, salonId) => {
        if (realtimeOutage) throw new Error('realtime down');
        ssePublisher.closeUserStreamsInSalon(userId, salonId);
      },
    };

    t = await startTestApp({
      overrides: [
        [CLOCK, clock],
        [SMS_SENDER, sms],
        [REALTIME_PUBLISHER, realtimeProxy],
      ],
    });
    ssePublisher = t.moduleRef.get(SseRealtimePublisher);
    db = t.moduleRef.get(getDataSourceToken());
    accounts = new StaffAccounts(db);
    world = new SalonWorld(db);

    const repo = t.moduleRef.get<Required<SalonMembershipRepository>>(SALON_MEMBERSHIP_REPOSITORY);
    const originalSave = repo.save.bind(repo);
    repo.save = async (membership) => {
      if (saveFailureOnce) {
        saveFailureOnce = false;
        throw new Error('simulated postgres failure');
      }
      return originalSave(membership);
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
    clarisse = await accounts.create('Clarisse Fotso');
    paul = await accounts.create('Paul Ebode');

    [akwa, bastos] = (await world.organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
      { name: 'Go Beauty Bastos', city: 'Yaoundé', district: 'Bastos' },
    ])) as [WorldSalon, WorldSalon];
    [elegance] = (await world.organizationOf(clarisse.id, [
      { name: 'Élégance Bonamoussadi', city: 'Douala', district: 'Bonamoussadi' },
    ])) as [WorldSalon];

    await world.membership(akwa.id, rodrigue.id, 'SALON_ADMIN');
    await world.membership(bastos.id, rodrigue.id, 'SALON_ADMIN');
    await world.membership(akwa.id, awa.id, 'HAIRDRESSER');
    await world.membership(akwa.id, hortense.id, 'FINANCE_MANAGER');
    await world.membership(akwa.id, grace.id, 'PRACTITIONER');
    await world.membership(elegance.id, paul.id, 'HAIRDRESSER');
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

  const putRole = (browser: Browser, csrfToken: string, membershipId: string, body: object) =>
    browser.agent.put(`${TEAM_URL}/${membershipId}/role`).set('x-csrf-token', csrfToken).send(body);

  const postRemoval = (browser: Browser, csrfToken: string, membershipId: string, body: object) =>
    browser.agent.post(`${TEAM_URL}/${membershipId}/removal`).set('x-csrf-token', csrfToken).send(body);

  const openSse = async (sid: string) => {
    const chunks: string[] = [];
    let closed = false;
    const connected = Promise.withResolvers<void>();
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/salon/realtime/stream',
        headers: { cookie: sid, accept: 'text/event-stream' },
      },
      (res) => {
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => chunks.push(chunk));
        res.on('end', () => {
          closed = true;
        });
        res.on('close', () => {
          closed = true;
        });
        if (res.statusCode === 200) connected.resolve();
      },
    );
    await connected.promise;
    await new Promise((r) => setTimeout(r, 50));
    return {
      chunks,
      isClosed: () => closed,
      destroy: () => req.destroy(),
    };
  };

  it('T12 — GET /api/salon/team lists active members (owner first, then by name), without phone/revoked/other salons, enforces staff:view, and uses the active partial index', async () => {
    const owner = await openSalon(mireille, akwa.id);

    const res = await owner.browser.get(TEAM_URL);
    expect(res.status).toBe(200);
    const team = SalonTeamSchema.parse(res.body.data);

    expect(team.members.map((m) => ({ name: m.name, role: m.role, isCurrentUser: m.isCurrentUser }))).toEqual(
      [
        { name: 'Mireille Ndongo', role: 'OWNER', isCurrentUser: true },
        { name: 'Awa Tchoua', role: 'HAIRDRESSER', isCurrentUser: false },
        { name: 'Grâce Mbarga', role: 'PRACTITIONER', isCurrentUser: false },
        { name: 'Hortense Mballa', role: 'FINANCE_MANAGER', isCurrentUser: false },
        { name: 'Rodrigue Etoa', role: 'SALON_ADMIN', isCurrentUser: false },
      ],
    );
    expect(JSON.stringify(res.body)).not.toMatch(/\+237|Paul Ebode|Clarisse/);

    // Sans staff:view → 403
    for (const person of [awa, hortense]) {
      const opened = await openSalon(person, akwa.id);
      const denied = await opened.browser.get(TEAM_URL);
      expect(denied.status).toBe(403);
      expect(denied.body.message).toBe(
        'Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire.',
      );
    }

    // Vérification réelle des index (pg_indexes + EXPLAIN ANALYZE BUFFERS)
    const indexes = await db.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('salon_memberships', 'users') ORDER BY tablename, indexname`,
    );
    expect(
      indexes.some((i: { indexname: string }) => i.indexname === 'salon_memberships_salon_active_idx'),
    ).toBe(true);
    const plan = await db.query(
      `EXPLAIN (ANALYZE, BUFFERS)
       SELECT m.id AS "membershipId", COALESCE(u.name, '') AS name, m.role, m.granted_at AS "joinedAt",
              (m.user_id = $2) AS "isCurrentUser", m.version
       FROM salon_memberships m
       JOIN users u ON u.id = m.user_id
       WHERE m.salon_id = $1 AND m.status = 'ACTIVE'
       ORDER BY (m.role = 'OWNER') DESC, LOWER(COALESCE(u.name, '')) ASC, m.id ASC`,
      [akwa.id, mireille.id],
    );
    expect(plan.length).toBeGreaterThan(0);
  });

  it('T13 — PUT /api/salon/team/:id/role applies immediately without re-sign-in, notifies SSE without PII, handles no-op and realtime outage', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const awaSession = await openSalon(awa, akwa.id);
    const awaMemId = await membershipIdOf(akwa.id, awa.id);

    // No-op : même rôle → 200, version inchangée, 0 audit, 0 signal
    const stream = await openSse(awaSession.sid);
    try {
      const noop = await putRole(owner.browser, owner.csrfToken, awaMemId, {
        role: 'HAIRDRESSER',
        version: 1,
      });
      expect(noop.status).toBe(200);
      expect(CollaboratorRoleChangedSchema.parse(noop.body.data)).toEqual({
        membershipId: awaMemId,
        role: 'HAIRDRESSER',
        version: 1,
      });
      const [{ n: auditAfterNoop }] = await db.query(
        `SELECT count(*)::int AS n FROM audit_log WHERE salon_id = $1 AND action = 'COLLABORATOR_ROLE_CHANGED'`,
        [akwa.id],
      );
      expect(auditAfterNoop).toBe(0);

      // Changement effectif : HAIRDRESSER → SALON_ADMIN
      const changed = await putRole(owner.browser, owner.csrfToken, awaMemId, {
        role: 'SALON_ADMIN',
        version: 1,
      });
      expect(changed.status).toBe(200);
      expect(CollaboratorRoleChangedSchema.parse(changed.body.data)).toEqual({
        membershipId: awaMemId,
        role: 'SALON_ADMIN',
        version: 2,
      });

      // Signal SSE reçu sans PII
      await eventually(() => stream.chunks.join('').includes('salon.member_role_changed'));
      const sseText = stream.chunks.join('');
      expect(sseText).toContain('salon.member_role_changed');
      expect(sseText).toContain(`"membershipId":"${awaMemId}"`);
      expect(sseText).toContain('"role":"SALON_ADMIN"');
      expect(sseText).not.toMatch(/Awa|Mireille|\+237/);
    } finally {
      stream.destroy();
    }

    // Dès sa requête suivante, sans se reconnecter, Awa peut inviter un collaborateur
    const invited = await awaSession.browser.post(INVITATIONS_URL, {
      name: 'Brice Nana',
      phone: '6 55 44 33 22',
      role: 'HAIRDRESSER',
    });
    expect(invited.status).toBe(201);

    // Panne du suivi en direct : changement conservé (200) et appliqué immédiatement
    realtimeOutage = true;
    const duringOutage = await putRole(owner.browser, owner.csrfToken, awaMemId, {
      role: 'PRACTITIONER',
      version: 2,
    });
    expect(duringOutage.status).toBe(200);
    expect(duringOutage.body.data.version).toBe(3);
    const awaSummary = await awaSession.browser.get(SESSION_URL);
    expect(awaSummary.body.data.permissions).toEqual(defaultPermissionsOf('PRACTITIONER'));
  });

  it('T14 — POST /api/salon/team/:id/removal marks REVOKED without deleting, drops active salon on next request, and hides salon', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const graceSession = await openSalon(grace, akwa.id);
    const graceMemId = await membershipIdOf(akwa.id, grace.id);

    const removed = await postRemoval(owner.browser, owner.csrfToken, graceMemId, { version: 1 });
    expect(removed.status).toBe(200);
    expect(CollaboratorRemovedSchema.parse(removed.body.data)).toEqual({
      membershipId: graceMemId,
      status: 'REVOKED',
      version: 2,
    });

    // Ligne conservée en base à l'état REVOKED
    const [row] = await db.query(
      `SELECT status, revoked_at, revoked_by_user_id, version FROM salon_memberships WHERE id = $1`,
      [graceMemId],
    );
    expect(row).toMatchObject({
      status: 'REVOKED',
      revoked_by_user_id: mireille.id,
      version: 2,
    });
    expect(row.revoked_at).not.toBeNull();

    // Grâce n'apparaît plus dans l'équipe active
    const team = await owner.browser.get(TEAM_URL);
    expect(team.body.data.members.some((m: { membershipId: string }) => m.membershipId === graceMemId)).toBe(
      false,
    );

    // Requête suivante de Grâce sur Akwa → 403 « Choisissez d’abord… », activeSalonId: null, Akwa disparu
    const nextAction = await graceSession.browser.get(TEAM_URL);
    expect(nextAction.status).toBe(403);
    expect(nextAction.body.message).toBe('Choisissez d’abord le salon sur lequel vous travaillez.');

    const summary = await graceSession.browser.get(SESSION_URL);
    expect(summary.status).toBe(200);
    expect(summary.body.data.activeSalonId).toBeNull();
    expect(summary.body.data.salons.some((s: { salonId: string }) => s.salonId === akwa.id)).toBe(false);

    // Tenter de rouvrir Akwa → 404 identique à un salon inconnu
    const reopenAkwa = await graceSession.browser.post(SELECT_URL, { salonId: akwa.id });
    const openUnknown = await graceSession.browser.post(SELECT_URL, { salonId: UNKNOWN_ID });
    expect(reopenAkwa.status).toBe(404);
    expect(reopenAkwa.body).toEqual(openUnknown.body);
  });

  it('T22 — removing an Akwa collaborator who is a GoMeCoiffer operations admin leaves their system role untouched', async () => {
    const serge = await accounts.create('Serge Kamga');
    await world.membership(akwa.id, serge.id, 'SALON_ADMIN');
    await db.query(
      `INSERT INTO platform_admin_roles (user_id, role, granted_at, granted_by_user_id)
       VALUES ($1, 'OPERATIONS_ADMIN', now(), NULL)`,
      [serge.id],
    );
    const owner = await openSalon(mireille, akwa.id);
    const sergeMembershipId = await membershipIdOf(akwa.id, serge.id);

    const removed = await postRemoval(owner.browser, owner.csrfToken, sergeMembershipId, { version: 1 });

    expect(removed.status).toBe(200);
    const roles = await db.query(`SELECT role FROM platform_admin_roles WHERE user_id = $1`, [serge.id]);
    expect(roles).toEqual([{ role: 'OPERATIONS_ADMIN' }]);
  });

  it('T15 — removal immediately closes target SSE streams on that salon only, keeps other salon open, and survives realtime outage', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const rodrigueAkwa = await openSalon(rodrigue, akwa.id);
    const rodrigueBastos = await openSalon(rodrigue, bastos.id);
    const rodrigueAkwaMemId = await membershipIdOf(akwa.id, rodrigue.id);

    const streamAkwa = await openSse(rodrigueAkwa.sid);
    const streamBastos = await openSse(rodrigueBastos.sid);
    try {
      const removed = await postRemoval(owner.browser, owner.csrfToken, rodrigueAkwaMemId, { version: 1 });
      expect(removed.status).toBe(200);

      await eventually(() => streamAkwa.isClosed());
      expect(streamAkwa.isClosed()).toBe(true);
      expect(streamBastos.isClosed()).toBe(false);

      // Le flux sur Bastos continue de recevoir des signaux
      const ownerBastos = await openSalon(mireille, bastos.id);
      const bastosChange = await ownerBastos.browser.agent
        .put(`${ROLES_URL}/HAIRDRESSER/permissions`)
        .set('x-csrf-token', ownerBastos.csrfToken)
        .send({ permissions: ['bookings:view-own'], version: 1 });
      expect(bastosChange.status).toBe(200);

      await eventually(() => streamBastos.chunks.join('').includes('salon.role_permissions_changed'));
      expect(streamBastos.chunks.join('')).toContain('salon.role_permissions_changed');
    } finally {
      streamAkwa.destroy();
      streamBastos.destroy();
    }

    // Panne du suivi en direct lors d'un retrait : 200 et effet immédiat à la requête suivante
    const graceSession = await openSalon(grace, akwa.id);
    const graceMemId = await membershipIdOf(akwa.id, grace.id);
    realtimeOutage = true;
    const removedDuringOutage = await postRemoval(owner.browser, owner.csrfToken, graceMemId, {
      version: 1,
    });
    expect(removedDuringOutage.status).toBe(200);
    const graceNext = await graceSession.browser.get(SESSION_URL);
    expect(graceNext.body.data.activeSalonId).toBeNull();
  });

  it('T16 — full reinstatement flow (UC-006 + UC-007) reactivates the same membership with new role and audits COLLABORATOR_REINSTATED', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const graceMemId = await membershipIdOf(akwa.id, grace.id);

    // 1. Retrait de Grâce
    const removed = await postRemoval(owner.browser, owner.csrfToken, graceMemId, { version: 1 });
    expect(removed.status).toBe(200);

    // 2. Mireille réinvite Grâce comme SALON_ADMIN (UC-006)
    const reinvited = await owner.browser.post(INVITATIONS_URL, {
      name: 'Grâce Mbarga',
      phone: grace.typed,
      role: 'SALON_ADMIN',
    });
    expect(reinvited.status).toBe(201);
    const invitationId = reinvited.body.data.invitationId as string;

    // 3. Grâce prouve son numéro et accepte (UC-007)
    const graceBrowser = t.browser();
    const sent = await graceBrowser.post('/api/public/invitations/code', { phone: grace.typed });
    expect(sent.status).toBe(202);
    const otp = codeIn(sms.lastTo(grace.e164));
    const proven = await graceBrowser.post('/api/public/invitations/phone-proof', {
      phone: grace.typed,
      code: otp,
    });
    expect(proven.status).toBe(200);

    const accepted = await graceBrowser.post(`/api/public/invitations/${invitationId}/acceptance`, {});
    expect(accepted.status).toBe(200);
    InvitationAcceptedSchema.parse(accepted.body.data);

    // 4. Même appartenance réactivée avec rôle SALON_ADMIN et version 3
    const [row] = await db.query(
      `SELECT id, role, status, revoked_at, revoked_by_user_id, reinstated_at, version
       FROM salon_memberships WHERE salon_id = $1 AND user_id = $2`,
      [akwa.id, grace.id],
    );
    expect(row).toMatchObject({
      id: graceMemId,
      role: 'SALON_ADMIN',
      status: 'ACTIVE',
      revoked_at: null,
      revoked_by_user_id: null,
      version: 3,
    });
    expect(row.reinstated_at).not.toBeNull();

    // 5. Grâce réapparaît dans l'équipe active et audit COLLABORATOR_REINSTATED tracé sans PII
    const team = await owner.browser.get(TEAM_URL);
    expect(team.body.data.members).toContainEqual(
      expect.objectContaining({ membershipId: graceMemId, role: 'SALON_ADMIN', version: 3 }),
    );
    const auditRows = await db.query(
      `SELECT action, subject_type, subject_id, actor_user_id, salon_id, details
       FROM audit_log WHERE salon_id = $1 AND action = 'COLLABORATOR_REINSTATED'`,
      [akwa.id],
    );
    expect(auditRows).toEqual([
      {
        action: 'COLLABORATOR_REINSTATED',
        subject_type: 'salon_membership',
        subject_id: graceMemId,
        actor_user_id: grace.id,
        salon_id: akwa.id,
        details: { userId: grace.id, role: 'SALON_ADMIN', invitationId },
      },
    ]);
  });

  it('T17 — enforces business protections (422): owner protected, no self-management, no privilege escalation, and already revoked', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const admin = await openSalon(rodrigue, akwa.id);
    const mireilleMemId = await membershipIdOf(akwa.id, mireille.id);
    const rodrigueMemId = await membershipIdOf(akwa.id, rodrigue.id);
    const awaMemId = await membershipIdOf(akwa.id, awa.id);
    const hortenseMemId = await membershipIdOf(akwa.id, hortense.id);
    const graceMemId = await membershipIdOf(akwa.id, grace.id);

    // Propriétaire protégé (par Rodrigue ET par Mireille elle-même)
    for (const actor of [admin, owner]) {
      const r1 = await putRole(actor.browser, actor.csrfToken, mireilleMemId, {
        role: 'HAIRDRESSER',
        version: 1,
      });
      expect([r1.status, r1.body.code]).toEqual([422, 'OWNER_MEMBERSHIP_PROTECTED']);
      const r2 = await postRemoval(actor.browser, actor.csrfToken, mireilleMemId, { version: 1 });
      expect([r2.status, r2.body.code]).toEqual([422, 'OWNER_MEMBERSHIP_PROTECTED']);
    }

    // Action sur soi-même (Rodrigue)
    const selfRole = await putRole(admin.browser, admin.csrfToken, rodrigueMemId, {
      role: 'HAIRDRESSER',
      version: 1,
    });
    expect([selfRole.status, selfRole.body.code]).toEqual([422, 'CANNOT_MANAGE_OWN_MEMBERSHIP']);
    const selfRemove = await postRemoval(admin.browser, admin.csrfToken, rodrigueMemId, { version: 1 });
    expect([selfRemove.status, selfRemove.body.code]).toEqual([422, 'CANNOT_MANAGE_OWN_MEMBERSHIP']);

    // Non-élévation : Rodrigue (sans finances) ne peut ni promouvoir Awa en FINANCE_MANAGER, ni toucher Hortense
    const promoteToFinance = await putRole(admin.browser, admin.csrfToken, awaMemId, {
      role: 'FINANCE_MANAGER',
      version: 1,
    });
    expect([promoteToFinance.status, promoteToFinance.body.code]).toEqual([422, 'ROLE_ABOVE_MANAGER']);

    const demoteHortense = await putRole(admin.browser, admin.csrfToken, hortenseMemId, {
      role: 'HAIRDRESSER',
      version: 1,
    });
    expect([demoteHortense.status, demoteHortense.body.code]).toEqual([422, 'ROLE_ABOVE_MANAGER']);

    const removeHortense = await postRemoval(admin.browser, admin.csrfToken, hortenseMemId, { version: 1 });
    expect([removeHortense.status, removeHortense.body.code]).toEqual([422, 'ROLE_ABOVE_MANAGER']);

    // Si Mireille ajoute finances:view au HAIRDRESSER, Rodrigue est bloqué sur Awa
    await owner.browser.agent
      .put(`${ROLES_URL}/HAIRDRESSER/permissions`)
      .set('x-csrf-token', owner.csrfToken)
      .send({ permissions: [...defaultPermissionsOf('HAIRDRESSER'), 'finances:view'], version: 1 });
    const blockedOnAwa = await postRemoval(admin.browser, admin.csrfToken, awaMemId, { version: 1 });
    expect([blockedOnAwa.status, blockedOnAwa.body.code]).toEqual([422, 'ROLE_ABOVE_MANAGER']);

    // Si Mireille donne les 3 permissions finances à SALON_ADMIN, Rodrigue peut gérer Hortense
    await owner.browser.agent
      .put(`${ROLES_URL}/SALON_ADMIN/permissions`)
      .set('x-csrf-token', owner.csrfToken)
      .send({
        permissions: [
          ...defaultPermissionsOf('SALON_ADMIN'),
          'finances:view',
          'finances:record-payment',
          'finances:export',
        ],
        version: 1,
      });
    const allowedOnHortense = await putRole(admin.browser, admin.csrfToken, hortenseMemId, {
      role: 'PRACTITIONER',
      version: 1,
    });
    expect(allowedOnHortense.status).toBe(200);

    // Membre déjà retiré → 422 MEMBERSHIP_ALREADY_REVOKED
    expect((await postRemoval(owner.browser, owner.csrfToken, graceMemId, { version: 1 })).status).toBe(200);
    const secondRole = await putRole(owner.browser, owner.csrfToken, graceMemId, {
      role: 'HAIRDRESSER',
      version: 2,
    });
    expect([secondRole.status, secondRole.body.code]).toEqual([422, 'MEMBERSHIP_ALREADY_REVOKED']);
    const secondRemove = await postRemoval(owner.browser, owner.csrfToken, graceMemId, { version: 2 });
    expect([secondRemove.status, secondRemove.body.code]).toEqual([422, 'MEMBERSHIP_ALREADY_REVOKED']);
  });

  it('T18 — uniform 404 across unknown/other-salon memberships, cross-salon isolation, and pending invitations preserved (D-049)', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const adminAkwa = await openSalon(rodrigue, akwa.id);
    const rodrigueAkwaMemId = await membershipIdOf(akwa.id, rodrigue.id);
    const rodrigueBastosMemId = await membershipIdOf(bastos.id, rodrigue.id);
    const paulEleganceMemId = await membershipIdOf(elegance.id, paul.id);

    // 404 strictement identique pour id inconnu, membre de Bastos, membre d'Élégance
    const unknownRes = await putRole(owner.browser, owner.csrfToken, UNKNOWN_ID, {
      role: 'HAIRDRESSER',
      version: 1,
    });
    const bastosRes = await putRole(owner.browser, owner.csrfToken, rodrigueBastosMemId, {
      role: 'HAIRDRESSER',
      version: 1,
    });
    const eleganceRes = await postRemoval(owner.browser, owner.csrfToken, paulEleganceMemId, {
      version: 1,
    });
    expect(unknownRes.status).toBe(404);
    expect(bastosRes.status).toBe(404);
    expect(eleganceRes.status).toBe(404);
    expect(bastosRes.body).toEqual(unknownRes.body);
    expect(eleganceRes.body).toEqual(unknownRes.body);

    // Rodrigue envoie une invitation dans Akwa, puis Mireille le retire d'Akwa
    const inv = await adminAkwa.browser.post(INVITATIONS_URL, {
      name: 'Brice Nana',
      phone: '6 55 44 33 22',
      role: 'HAIRDRESSER',
    });
    expect(inv.status).toBe(201);

    const removed = await postRemoval(owner.browser, owner.csrfToken, rodrigueAkwaMemId, { version: 1 });
    expect(removed.status).toBe(200);

    // Invitation de Brice reste PENDING (D-049)
    const invitations = await owner.browser.get(INVITATIONS_URL);
    expect(invitations.body.data).toContainEqual(
      expect.objectContaining({ id: inv.body.data.invitationId, status: 'PENDING' }),
    );

    // Rodrigue reste Administrateur actif de Bastos
    const rodrigueBastos = await openSalon(rodrigue, bastos.id);
    const bastosSession = await rodrigueBastos.browser.get(SESSION_URL);
    expect(bastosSession.status).toBe(200);
    expect(bastosSession.body.data.activeSalonId).toBe(bastos.id);
  });

  it('T19 — enforces strict validation (400), auth (401), CSRF (403), active salon (403), CLIENT session (403), and staff:manage (403)', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const awaMemId = await membershipIdOf(akwa.id, awa.id);

    // Rôles interdits, UUID mal formé, version absente, clés en trop → 400
    for (const invalidRole of ['OWNER', 'SUPER_ADMIN', 'ESTHETICIAN']) {
      const res = await putRole(owner.browser, owner.csrfToken, awaMemId, {
        role: invalidRole,
        version: 1,
      });
      expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_FAILED']);
    }
    const badUuid = await putRole(owner.browser, owner.csrfToken, 'membre-1', {
      role: 'SALON_ADMIN',
      version: 1,
    });
    expect(badUuid.status).toBe(400);

    for (const badBody of [
      { role: 'SALON_ADMIN' },
      { role: 'SALON_ADMIN', version: 1, salonId: bastos.id },
      { role: 'SALON_ADMIN', version: 1, status: 'REVOKED' },
    ]) {
      const res = await putRole(owner.browser, owner.csrfToken, awaMemId, badBody);
      expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_FAILED']);
    }

    // Sans session → 401
    const anonymous = t.browser();
    const publicCsrf = (await anonymous.get('/api/public/session/csrf')).body.data.csrfToken as string;
    const unauth = await putRole(anonymous, publicCsrf, awaMemId, { role: 'SALON_ADMIN', version: 1 });
    expect([unauth.status, unauth.body.code]).toEqual([401, 'UNAUTHENTICATED']);

    // Sans CSRF → 403
    const noCsrf = await owner.browser.agent
      .put(`${TEAM_URL}/${awaMemId}/role`)
      .send({ role: 'SALON_ADMIN', version: 1 });
    expect([noCsrf.status, noCsrf.body.code]).toEqual([403, 'CSRF_INVALID']);

    // Sans salon actif → 403
    const withoutSalon = t.browser();
    const signedIn = await accounts.signIn(withoutSalon, mireille);
    const noSalon = await putRole(withoutSalon, signedIn.body.data.csrfToken, awaMemId, {
      role: 'SALON_ADMIN',
      version: 1,
    });
    expect(noSalon.status).toBe(403);
    expect(noSalon.body.message).toBe('Choisissez d’abord le salon sur lequel vous travaillez.');

    // Session CLIENT → 403 STAFF_SIGN_IN_REQUIRED
    const clientBrowser = t.browser();
    const sentCode = await clientBrowser.post('/api/public/client/code', {
      phone: mireille.typed,
      termsAccepted: true,
    });
    expect(sentCode.status).toBe(202);
    const verified = await clientBrowser.post('/api/public/client/session', {
      phone: mireille.typed,
      code: codeIn(sms.lastTo(mireille.e164)),
    });
    expect(verified.status).toBe(200);
    const clientDenied = await clientBrowser.get(TEAM_URL);
    expect([clientDenied.status, clientDenied.body.code]).toEqual([403, 'STAFF_SIGN_IN_REQUIRED']);

    // Rodrigue privé de staff:manage → 403
    await owner.browser.agent
      .put(`${ROLES_URL}/SALON_ADMIN/permissions`)
      .set('x-csrf-token', owner.csrfToken)
      .send({
        permissions: defaultPermissionsOf('SALON_ADMIN').filter((p) => p !== 'staff:manage'),
        version: 1,
      });
    const admin = await openSalon(rodrigue, akwa.id);
    const denied = await putRole(admin.browser, admin.csrfToken, awaMemId, {
      role: 'PRACTITIONER',
      version: 1,
    });
    expect(denied.status).toBe(403);
  });

  it('T20 — rejects stale version (409), serializes concurrent writes on same member, allows parallel writes on different members, and rolls back on failure', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const awaMemId = await membershipIdOf(akwa.id, awa.id);
    const graceMemId = await membershipIdOf(akwa.id, grace.id);

    // Deux opérations parallèles sur Awa (changement ∥ retrait) → 200 + 409, 1 ligne d'audit
    const [a, b] = await Promise.all([
      putRole(owner.browser, owner.csrfToken, awaMemId, { role: 'SALON_ADMIN', version: 1 }),
      postRemoval(owner.browser, owner.csrfToken, awaMemId, { version: 1 }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const [{ n: awaAudits }] = await db.query(
      `SELECT count(*)::int AS n FROM audit_log WHERE salon_id = $1 AND subject_id = $2`,
      [akwa.id, awaMemId],
    );
    expect(awaAudits).toBe(1);

    // Version périmée → 409 TEAM_MEMBER_CHANGED_MEANWHILE
    const hortenseMemId = await membershipIdOf(akwa.id, hortense.id);
    expect(
      (await putRole(owner.browser, owner.csrfToken, hortenseMemId, { role: 'PRACTITIONER', version: 1 }))
        .status,
    ).toBe(200);
    const stale = await postRemoval(owner.browser, owner.csrfToken, hortenseMemId, { version: 1 });
    expect([stale.status, stale.body.code]).toEqual([409, 'TEAM_MEMBER_CHANGED_MEANWHILE']);

    // Deux membres différents en parallèle → 2 × 200
    const rodrigueMemId = await membershipIdOf(akwa.id, rodrigue.id);
    const [r1, r2] = await Promise.all([
      putRole(owner.browser, owner.csrfToken, rodrigueMemId, { role: 'PRACTITIONER', version: 1 }),
      putRole(owner.browser, owner.csrfToken, graceMemId, { role: 'HAIRDRESSER', version: 1 }),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);

    // Panne forcée pendant le retrait → 500 sans détail, 0 écriture, 0 audit, flux SSE toujours ouvert
    const graceSession = await openSalon(grace, akwa.id);
    const stream = await openSse(graceSession.sid);
    try {
      saveFailureOnce = true;
      const failed = await postRemoval(owner.browser, owner.csrfToken, graceMemId, { version: 2 });
      expect(failed.status).toBe(500);
      expect(JSON.stringify(failed.body)).not.toMatch(/postgres|simulated/i);

      const [stillActive] = await db.query(`SELECT status, version FROM salon_memberships WHERE id = $1`, [
        graceMemId,
      ]);
      expect(stillActive).toEqual({ status: 'ACTIVE', version: 2 });
      const [{ n: removalAudits }] = await db.query(
        `SELECT count(*)::int AS n FROM audit_log WHERE salon_id = $1 AND subject_id = $2 AND action = 'COLLABORATOR_REMOVED'`,
        [akwa.id, graceMemId],
      );
      expect(removalAudits).toBe(0);
      expect(stream.isClosed()).toBe(false);
    } finally {
      stream.destroy();
    }
  });

  it('T21 — audits COLLABORATOR_ROLE_CHANGED and COLLABORATOR_REMOVED without personal data', async () => {
    const owner = await openSalon(mireille, akwa.id);
    const awaMemId = await membershipIdOf(akwa.id, awa.id);
    const graceMemId = await membershipIdOf(akwa.id, grace.id);

    expect(
      (await putRole(owner.browser, owner.csrfToken, awaMemId, { role: 'SALON_ADMIN', version: 1 })).status,
    ).toBe(200);
    expect((await postRemoval(owner.browser, owner.csrfToken, graceMemId, { version: 1 })).status).toBe(200);

    const rows = await db.query(
      `SELECT action, subject_type, subject_id, actor_user_id, salon_id, details
       FROM audit_log
       WHERE salon_id = $1 AND action IN ('COLLABORATOR_ROLE_CHANGED', 'COLLABORATOR_REMOVED')
       ORDER BY id ASC`,
      [akwa.id],
    );
    expect(rows).toEqual([
      {
        action: 'COLLABORATOR_ROLE_CHANGED',
        subject_type: 'salon_membership',
        subject_id: awaMemId,
        actor_user_id: mireille.id,
        salon_id: akwa.id,
        details: { userId: awa.id, previousRole: 'HAIRDRESSER', newRole: 'SALON_ADMIN' },
      },
      {
        action: 'COLLABORATOR_REMOVED',
        subject_type: 'salon_membership',
        subject_id: graceMemId,
        actor_user_id: mireille.id,
        salon_id: akwa.id,
        details: { userId: grace.id, role: 'PRACTITIONER' },
      },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/Mireille|Awa|Grâce|\+237|127\.0\.0\.1/);
  });
});
