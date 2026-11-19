import {
  CollaboratorInvitedSchema,
  InvitationCancelledSchema,
  SessionSummarySchema,
} from '@gomecoiffer/contracts';
import { Injectable } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOCK } from '../../../../shared/application/ports.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { CollaboratorInvited } from '../../domain/events/collaborator-invited.js';
import { INVITATION_NOTIFIER } from '../../domain/ports/invitation-notifier.port.js';
import { DAY_MS, NOW } from '../builders/invitation-builders.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { type StaffAccount, StaffAccounts } from '../builders/staff-accounts.js';
import { InMemoryInvitationNotifier } from '../fakes/invitation-fakes.js';

const sms = new InMemoryInvitationNotifier();
const failure = { armed: false };

/** Simule une panne pendant l'enregistrement : le subscriber s'exécute dans la transaction de la commande. */
@Injectable()
class WhenCollaboratorInvitedFailing {
  readonly subscribesTo = CollaboratorInvited;
  handle() {
    if (failure.armed) throw new Error('database down');
  }
}

interface InvitationRow {
  readonly role: string;
  readonly status: string;
}

const INVITATIONS = '/api/salon/invitations';
const SELECT = '/api/salon/session/active-salon';
const BRICE = { name: 'Brice Nana', phone: '6 55 44 33 22', role: 'HAIRDRESSER' };
const BRICE_E164 = '+237655443322';
const SMS_TEXT =
  'GoMeCoiffer : un salon vous invite à rejoindre son équipe comme Coiffeur / Coiffeuse / Barbier. ' +
  'Pour accepter avant le 26/11, ouvrez gomecoiffer.cm/rejoindre avec ce numéro. ' +
  'Ne communiquez jamais un code reçu par SMS.';
const UNKNOWN_ID = '0195f000-0000-7000-8000-00000000dead';
const NO_ACTIVE_SALON = 'Choisissez d’abord le salon sur lequel vous travaillez.';
const NO_RIGHT = 'Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire.';

describe('A salon owner invites a collaborator and cancels an invitation', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let accounts: StaffAccounts;
  let world: SalonWorld;
  let mireille: StaffAccount;
  let paul: StaffAccount;
  let clarisse: StaffAccount;
  let awa: StaffAccount;
  let akwa: WorldSalon;
  let bastos: WorldSalon;
  let elegance: WorldSalon;

  beforeAll(async () => {
    clock = new FixedClock(NOW);
    t = await startTestApp({
      providers: [WhenCollaboratorInvitedFailing],
      overrides: [
        [CLOCK, clock],
        [INVITATION_NOTIFIER, sms],
      ],
    });
    db = t.moduleRef.get(getDataSourceToken());
    accounts = new StaffAccounts(db);
    world = new SalonWorld(db);
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    clock.set(NOW);
    failure.armed = false;
    sms.sent.length = 0;
    sms.outage = false;
    await db.query(`DELETE FROM salon_invitations`);
    await db.query(`DELETE FROM audit_log`);
    mireille = await accounts.create('Mireille Ndongo');
    paul = await accounts.create('Paul Ebode');
    clarisse = await accounts.create('Clarisse Fotso');
    awa = await accounts.create('Awa Tchoua');
    [akwa, bastos] = (await world.organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
      { name: 'Go Beauty Bastos', city: 'Yaoundé', district: 'Bastos' },
    ])) as [WorldSalon, WorldSalon];
    [elegance] = (await world.organizationOf(clarisse.id, [
      { name: 'Élégance Bonamoussadi', city: 'Douala', district: 'Bonamoussadi' },
    ])) as [WorldSalon];
    await world.membership(elegance.id, paul.id, 'HAIRDRESSER');
    await world.membership(akwa.id, awa.id, 'HAIRDRESSER');
  });

  const signedIn = async (person: StaffAccount, salon?: WorldSalon) => {
    const browser = t.browser();
    await accounts.signIn(browser, person);
    if (salon) await openSalon(browser, salon);
    return browser;
  };
  const openSalon = async (browser: Browser, salon: WorldSalon) => {
    const res = await browser.post(SELECT, { salonId: salon.id });
    browser.useCsrfToken(res.body.data.csrfToken);
  };
  const invite = (browser: Browser, body: object = BRICE) => browser.post(INVITATIONS, body);
  const cancel = (browser: Browser, id: string) => browser.post(`${INVITATIONS}/${id}/cancellation`);
  const rows = (salonId?: string): Promise<InvitationRow[]> =>
    db.query(
      `SELECT * FROM salon_invitations ${salonId ? 'WHERE salon_id = $1' : ''} ORDER BY sent_at`,
      salonId ? [salonId] : [],
    );
  const insertInvitation = (over: {
    salonId: string;
    phone: string;
    status?: string;
    sentAt?: Date;
    expiresAt?: Date;
    notifiedBySms?: boolean;
  }) =>
    db.query(
      `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, ended_at, notified_by_sms, version)
       VALUES ($1, $2, 'Quelqu un', $3, 'HAIRDRESSER', $4, $5, $6, $7, $8, $9, 1)`,
      [
        randomUUID(),
        over.salonId,
        over.phone,
        mireille.id,
        over.sentAt ?? NOW,
        over.expiresAt ?? new Date(NOW.getTime() + 7 * DAY_MS),
        over.status ?? 'PENDING',
        over.status === 'CANCELLED' ? NOW : null,
        over.notifiedBySms ?? false,
      ],
    );
  const settled = () => new Promise((resolve) => setTimeout(resolve, 60));
  const auditActions = async () =>
    (await db.query(
      `SELECT action, details::text AS details FROM audit_log WHERE subject_type = 'salon_invitation' ORDER BY occurred_at, id`,
    )) as Array<{
      action: string;
      details: string;
    }>;

  describe('inviting', () => {
    it('records a pending invitation for 7 days and answers with it, without giving any access to the invited person', async () => {
      const owner = await signedIn(mireille, akwa);

      const res = await invite(owner);

      expect(res.status).toBe(201);
      expect(CollaboratorInvitedSchema.parse(res.body.data)).toMatchObject({
        name: 'Brice Nana',
        phone: BRICE_E164,
        role: 'HAIRDRESSER',
        expiresAt: '2026-11-26T09:00:00.000Z',
      });
      expect(await rows(akwa.id)).toHaveLength(1);
      expect(
        await db.query(`SELECT 1 FROM salon_memberships WHERE salon_id = $1 AND role <> 'OWNER'`, [akwa.id]),
      ).toHaveLength(1);
    });

    it('leaves the invited person with the same salons, and a salon that answers as if it did not exist', async () => {
      const owner = await signedIn(mireille, akwa);
      await invite(owner, { name: 'Paul Ebode', phone: paul.typed, role: 'SALON_ADMIN' });
      const invited = await signedIn(paul);

      const summary = SessionSummarySchema.parse((await invited.get('/api/salon/session')).body.data);
      const opening = await invited.post(SELECT, { salonId: akwa.id });
      const missing = await invited.post(SELECT, { salonId: UNKNOWN_ID });

      expect(summary.salons.map((s) => s.name)).toEqual(['Élégance Bonamoussadi']);
      expect(opening.status).toBe(404);
      expect(opening.body).toEqual({ ...missing.body, message: opening.body.message });
      expect(opening.body.message).toBe(missing.body.message);
    });

    it('invites in the salon that is open now, and leaves the other salon alone', async () => {
      const owner = await signedIn(mireille, bastos);

      await invite(owner);

      expect(await rows(bastos.id)).toHaveLength(1);
      expect(await rows(akwa.id)).toHaveLength(0);
    });

    it.each([['SALON_ADMIN'], ['HAIRDRESSER'], ['FINANCE_MANAGER'], ['PRACTITIONER']])(
      'accepts the role %s',
      async (role) => {
        const owner = await signedIn(mireille, akwa);

        const res = await invite(owner, { ...BRICE, role });

        expect(res.status).toBe(201);
        expect((await rows(akwa.id))[0]!.role).toBe(role);
      },
    );

    it('trims the name and normalises the number', async () => {
      const owner = await signedIn(mireille, akwa);

      const res = await invite(owner, {
        name: '   Brice    Nana  ',
        phone: '+237 655 44 33 22',
        role: 'HAIRDRESSER',
      });

      expect(res.body.data).toMatchObject({ name: 'Brice Nana', phone: BRICE_E164 });
    });
  });

  describe('refusals on the request', () => {
    it.each([
      ['a salon', { ...BRICE, salonId: randomUUID() }],
      ['a validity', { ...BRICE, expiresAt: '2027-01-01T00:00:00Z' }],
      ['a permission', { ...BRICE, permissions: ['bookings:manage'] }],
      ['a specialty', { ...BRICE, specialties: ['Barbier'] }],
      ['the role Owner', { ...BRICE, role: 'OWNER' }],
      ['a job as a role', { ...BRICE, role: 'ESTHETICIAN' }],
      ['a system role', { ...BRICE, role: 'PLATFORM_ADMIN' }],
      ['a name of one character', { ...BRICE, name: 'B' }],
      ['a name padded with an invisible character', { ...BRICE, name: 'B\u200B' }],
      ['a name of 81 characters', { ...BRICE, name: 'x'.repeat(81) }],
      ['no name', { phone: BRICE.phone, role: BRICE.role }],
    ])('refuses a request with %s, and records nothing', async (_label, body) => {
      const owner = await signedIn(mireille, akwa);

      const res = await invite(owner, body);

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('ERROR');
      expect(await rows()).toHaveLength(0);
      expect(await auditActions()).toHaveLength(0);
    });

    it.each([['6 55 44 33 2'], ['+33 6 12 34 56 78'], ['abc']])(
      'refuses the number %s as invalid, and records nothing',
      async (phone) => {
        const owner = await signedIn(mireille, akwa);

        const res = await invite(owner, { ...BRICE, phone });

        expect(res.status).toBe(422);
        expect(res.body.message).toBe(
          'Numéro de téléphone camerounais invalide (9 chiffres, ex. 6 77 12 34 56).',
        );
        expect(await rows()).toHaveLength(0);
      },
    );

    it('refuses a request without session', async () => {
      const res = await invite(t.browser());

      expect(res.status).toBe(401);
      expect(await rows()).toHaveLength(0);
    });

    it('refuses a request without security token', async () => {
      const owner = await signedIn(mireille, akwa);

      const res = await owner.agent.post(INVITATIONS).send(BRICE);

      expect(res.status).toBe(403);
      expect(await rows()).toHaveLength(0);
    });

    it('refuses a person who has not opened any salon', async () => {
      const res = await invite(await signedIn(paul));

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(NO_ACTIVE_SALON);
    });

    it('refuses a hairdresser, who cannot invite', async () => {
      const res = await invite(await signedIn(awa, akwa));

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(NO_RIGHT);
      expect(await rows()).toHaveLength(0);
      expect(await auditActions()).toHaveLength(0);
    });
  });

  describe('refusals on the business rules', () => {
    it('refuses a person who already belongs to the team of the salon, without any SMS', async () => {
      const owner = await signedIn(mireille, akwa);

      const res = await invite(owner, { name: 'Awa Tchoua', phone: awa.typed, role: 'HAIRDRESSER' });
      await settled();

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("Cette personne fait déjà partie de l'équipe de ce salon.");
      expect(sms.sent).toHaveLength(0);
    });

    it('refuses the owner herself', async () => {
      const owner = await signedIn(mireille, akwa);

      const res = await invite(owner, {
        name: 'Mireille Ndongo',
        phone: mireille.typed,
        role: 'HAIRDRESSER',
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ALREADY_SALON_MEMBER');
    });

    it('refuses a second invitation while the first is pending, which keeps its role', async () => {
      const owner = await signedIn(mireille, akwa);
      await invite(owner);

      const res = await invite(owner, { ...BRICE, role: 'FINANCE_MANAGER' });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        'Une invitation est déjà en attente pour ce numéro. Annulez-la pour en envoyer une nouvelle.',
      );
      expect((await rows(akwa.id)).map((r) => r.role)).toEqual(['HAIRDRESSER']);
    });

    it('invites again after the first invitation expired, which is shown as expired', async () => {
      const owner = await signedIn(mireille, akwa);
      await insertInvitation({
        salonId: akwa.id,
        phone: BRICE_E164,
        sentAt: new Date(NOW.getTime() - 9 * DAY_MS),
        expiresAt: new Date(NOW.getTime() - 2 * DAY_MS),
      });

      const res = await invite(owner);

      expect(res.status).toBe(201);
      expect((await rows(akwa.id)).map((r) => r.status)).toEqual(['EXPIRED', 'PENDING']);
    });

    it('lets two salons invite the same number', async () => {
      await invite(await signedIn(clarisse, elegance));

      const res = await invite(await signedIn(mireille, akwa));

      expect(res.status).toBe(201);
      expect(await rows()).toHaveLength(2);
    });

    it('keeps a single pending invitation and sends a single SMS when the same invitation is sent twice at once', async () => {
      const owner = await signedIn(mireille, akwa);

      const results = await Promise.all([invite(owner), invite(owner)]);
      await vi.waitFor(() => expect(sms.sent).toHaveLength(1));
      await settled();

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await rows(akwa.id)).toHaveLength(1);
      expect(sms.sent).toHaveLength(1);
    });

    it('refuses the 21st invitation of the salon within 24 hours, and accepts the 20th', async () => {
      const owner = await signedIn(mireille, akwa);
      for (let n = 0; n < 19; n++)
        await insertInvitation({
          salonId: akwa.id,
          phone: `+2376600000${String(n).padStart(2, '0')}`,
          status: 'CANCELLED',
          sentAt: new Date(NOW.getTime() - 24 * 3_600_000),
        });
      expect((await invite(owner)).status).toBe(201);

      const res = await invite(owner, { ...BRICE, phone: '6 55 44 33 23' });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('INVITATION_QUOTA_REACHED');
    });

    it('refuses a 51st pending invitation', async () => {
      const owner = await signedIn(mireille, akwa);
      for (let n = 0; n < 50; n++)
        await insertInvitation({
          salonId: akwa.id,
          phone: `+2376600001${String(n).padStart(2, '0')}`,
          sentAt: new Date(NOW.getTime() - 3 * DAY_MS),
        });

      const res = await invite(owner);

      expect(res.status).toBe(422);
      expect(res.body.code).toBe('PENDING_INVITATIONS_LIMIT');
      expect(res.body.message).toBe(
        "Vous avez déjà 50 invitations en attente. Annulez celles qui ne servent plus avant d'en envoyer d'autres.",
      );
    });
  });

  describe('the SMS that warns the invited person', () => {
    it('sends the fixed text, without any code, after the answer', async () => {
      const owner = await signedIn(mireille, akwa);

      await invite(owner);

      await vi.waitFor(() => expect(sms.sent).toEqual([{ to: BRICE_E164, text: SMS_TEXT }]));
    });

    it('answers the same, with the same text, whatever account the number carries', async () => {
      const owner = await signedIn(mireille, akwa);
      const light = await accounts.create('Aïcha Bello', { password: false });
      const answers = [
        await invite(owner, BRICE),
        await invite(owner, { name: 'Aïcha Bello', phone: light.typed, role: 'HAIRDRESSER' }),
        await invite(owner, { name: 'Paul Ebode', phone: paul.typed, role: 'HAIRDRESSER' }),
      ];
      await vi.waitFor(() => expect(sms.sent).toHaveLength(3));

      expect(answers.map((a) => a.status)).toEqual([201, 201, 201]);
      expect(answers.map((a) => Object.keys(a.body.data).sort())).toEqual([
        Object.keys(answers[0]!.body.data).sort(),
        Object.keys(answers[0]!.body.data).sort(),
        Object.keys(answers[0]!.body.data).sort(),
      ]);
      expect(new Set(sms.sent.map((s) => s.text)).size).toBe(1);
    });

    it('keeps the invitation when the SMS provider is down', async () => {
      sms.outage = true;
      const owner = await signedIn(mireille, akwa);

      const res = await invite(owner);
      await settled();

      expect(res.status).toBe(201);
      expect(await rows(akwa.id)).toHaveLength(1);
    });

    it('records the 4th invitation of a number within 24 hours, with the same answer and no SMS', async () => {
      const [deido] = (await world.organizationOf(paul.id, [
        { name: 'Paul Barber Deïdo', city: 'Douala', district: 'Deïdo' },
      ])) as [WorldSalon];
      const owner = await signedIn(mireille, akwa);
      for (const salon of [bastos, elegance, deido])
        await insertInvitation({
          salonId: salon.id,
          phone: BRICE_E164,
          status: 'CANCELLED',
          sentAt: new Date(NOW.getTime() - 24 * 3_600_000),
          notifiedBySms: true,
        });

      const res = await invite(owner);
      await settled();

      expect(res.status).toBe(201);
      expect(Object.keys(res.body.data).sort()).toEqual([
        'expiresAt',
        'invitationId',
        'name',
        'phone',
        'role',
      ]);
      expect(sms.sent).toHaveLength(0);
      expect(await rows(akwa.id)).toHaveLength(1);
    });
  });

  describe('a failure while recording', () => {
    it('leaves nothing, not even a SMS, and works when the same request is sent again', async () => {
      const owner = await signedIn(mireille, akwa);
      failure.armed = true;

      const failed = await invite(owner);
      await settled();

      expect(failed.status).toBe(500);
      expect(JSON.stringify(failed.body)).not.toContain('database down');
      expect(await rows()).toHaveLength(0);
      expect(await auditActions()).toHaveLength(0);
      expect(sms.sent).toHaveLength(0);

      failure.armed = false;
      expect((await invite(owner)).status).toBe(201);
    });
  });

  describe('cancelling', () => {
    const invited = async (owner: Browser) => (await invite(owner)).body.data.invitationId as string;

    it('cancels a pending invitation once, and refuses to cancel it again', async () => {
      const owner = await signedIn(mireille, akwa);
      const id = await invited(owner);

      const first = await cancel(owner, id);
      const second = await cancel(owner, id);

      expect(first.status).toBe(200);
      expect(InvitationCancelledSchema.parse(first.body.data)).toEqual({
        invitationId: id,
        status: 'CANCELLED',
      });
      expect(second.status).toBe(422);
      expect(second.body.message).toBe(
        "Cette invitation n'est plus en attente : elle a été acceptée, annulée ou elle a expiré.",
      );
      expect((await rows(akwa.id))[0]!.status).toBe('CANCELLED');
    });

    it('lets the same number be invited again after the cancellation', async () => {
      const owner = await signedIn(mireille, akwa);
      await cancel(owner, await invited(owner));

      expect((await invite(owner)).status).toBe(201);
    });

    it('refuses an invitation that has expired', async () => {
      const owner = await signedIn(mireille, akwa);
      const id = await invited(owner);
      await db.query(`UPDATE salon_invitations SET expires_at = $1`, [new Date(NOW.getTime() - 3_600_000)]);

      expect((await cancel(owner, id)).status).toBe(422);
    });

    it('answers a missing invitation, an invitation of another organisation and an invitation of another salon of the same organisation with the very same refusal', async () => {
      const ofClarisse = await invited(await signedIn(clarisse, elegance));
      const ofBastos = await invited(await signedIn(mireille, bastos));
      const owner = await signedIn(mireille, akwa);

      const missing = await cancel(owner, UNKNOWN_ID);
      const foreignOrganisation = await cancel(owner, ofClarisse);
      const otherSalon = await cancel(owner, ofBastos);

      expect([missing.status, foreignOrganisation.status, otherSalon.status]).toEqual([404, 404, 404]);
      expect(foreignOrganisation.body).toEqual(missing.body);
      expect(otherSalon.body).toEqual(missing.body);
      expect((await rows()).map((r) => r.status)).toEqual(['PENDING', 'PENDING']);
    });

    it('refuses a malformed identifier', async () => {
      const owner = await signedIn(mireille, akwa);

      expect((await cancel(owner, 'not-a-uuid')).status).toBe(400);
    });

    it('refuses a hairdresser', async () => {
      const id = await invited(await signedIn(mireille, akwa));

      const res = await cancel(await signedIn(awa, akwa), id);

      expect(res.status).toBe(403);
      expect((await rows(akwa.id))[0]!.status).toBe('PENDING');
    });
  });

  describe('the audit trail', () => {
    it('records the invitation then its cancellation, with salon, role and author but without name or number', async () => {
      const owner = await signedIn(mireille, akwa);
      const id = (await invite(owner)).body.data.invitationId as string;
      await cancel(owner, id);

      const audit = await db.query(
        `SELECT action, salon_id, actor_user_id, subject_id, details::text AS details FROM audit_log WHERE subject_type = 'salon_invitation' ORDER BY occurred_at, id`,
      );

      expect(audit.map((a: { action: string }) => a.action)).toEqual([
        'COLLABORATOR_INVITED',
        'INVITATION_CANCELLED',
      ]);
      expect(
        audit.every(
          (a: { salon_id: string; actor_user_id: string; subject_id: string }) =>
            a.salon_id === akwa.id && a.actor_user_id === mireille.id && a.subject_id === id,
        ),
      ).toBe(true);
      expect(audit[0].details).toContain('HAIRDRESSER');
      expect(JSON.stringify(audit)).not.toContain('Brice');
      expect(JSON.stringify(audit)).not.toContain('6554');
    });

    it('records nothing after a refusal', async () => {
      const owner = await signedIn(mireille, akwa);
      await invite(owner);
      await invite(owner);

      expect(await auditActions()).toHaveLength(1);
    });
  });

  describe('concurrent requests against the daily quota', () => {
    it('accepts only one invitation when 19 were already sent today and several POST arrive together', async () => {
      await db.query(
        `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, notified_by_sms, version)
         SELECT gen_random_uuid(), $1::uuid, 'Invité ' || g, '+2376500' || lpad(g::text, 5, '0'), 'HAIRDRESSER', $2::uuid,
                $3::timestamptz, $3::timestamptz + interval '7 days', 'PENDING', true, 1
         FROM generate_series(1, 19) g`,
        [akwa.id, mireille.id, NOW],
      );
      const owner = await signedIn(mireille, akwa);

      const responses = await Promise.all([
        invite(owner, { ...BRICE, phone: '6 77 11 00 01' }),
        invite(owner, { ...BRICE, phone: '6 77 11 00 02' }),
        invite(owner, { ...BRICE, phone: '6 77 11 00 03' }),
      ]);

      expect(responses.map((r) => r.status).sort()).toEqual([201, 422, 422]);
      expect(await rows(akwa.id)).toHaveLength(20);
    });
  });
});
