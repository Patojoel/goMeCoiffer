import { beforeEach, describe, expect, it } from 'vitest';
import { InviteCollaboratorSchema } from '@gomecoiffer/contracts';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { InviteCollaborator } from '../../application/commands/invite-collaborator/invite-collaborator.command.js';
import { InviteCollaboratorHandler } from '../../application/commands/invite-collaborator/invite-collaborator.handler.js';
import { AlreadySalonMemberError } from '../../domain/exceptions/already-salon-member.error.js';
import { InvitationAlreadyPendingError } from '../../domain/exceptions/invitation-already-pending.error.js';
import { InvitationQuotaReachedError } from '../../domain/exceptions/invitation-quota-reached.error.js';
import { PendingInvitationsLimitError } from '../../domain/exceptions/pending-invitations-limit.error.js';
import { RoleAboveInviterError } from '../../domain/exceptions/role-above-inviter.error.js';
import type { SalonRole } from '../../domain/enums/salon-role.enum.js';
import { RoleGrantPolicy } from '../../domain/services/role-grant-policy.js';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import {
  FakeAfterCommit,
  InMemoryInvitationChecks,
  InMemoryInvitationNotifier,
  InMemoryInvitationRepository,
} from '../fakes/invitation-fakes.js';
import { InMemoryAuditTrail } from '../fakes/organization-fakes.js';
import {
  AKWA_ID,
  anInvitation,
  BASTOS_ID,
  BRICE_PHONE,
  DAY_MS,
  ELEGANCE_ID,
  NOW,
} from '../builders/invitation-builders.js';
import { MIREILLE_ID } from '../builders/organization-builders.js';

const OWNER_PERMISSIONS = ['staff:invite', 'finances:view', 'bookings:manage'];
const SMS_TEXT =
  'GoMeCoiffer : un salon vous invite à rejoindre son équipe comme Coiffeur / Coiffeuse / Barbier. ' +
  'Pour accepter avant le 26/11, ouvrez gomecoiffer.cm/rejoindre avec ce numéro. ' +
  'Ne communiquez jamais un code reçu par SMS.';
/** Numéros distincts valides : 6 70 00 00 NN. */
const phoneN = (n: number) => `+2376700000${String(n).padStart(2, '0')}`;

describe('Inviting a collaborator into a salon', () => {
  let invitations: InMemoryInvitationRepository;
  let checks: InMemoryInvitationChecks;
  let notifier: InMemoryInvitationNotifier;
  let audit: InMemoryAuditTrail;
  let afterCommit: FakeAfterCommit;
  let clock: FixedClock;
  let handler: InviteCollaboratorHandler;

  beforeEach(() => {
    invitations = new InMemoryInvitationRepository();
    checks = new InMemoryInvitationChecks(invitations)
      .withSalon(AKWA_ID, 'Go Beauty Akwa')
      .withSalon(BASTOS_ID, 'Go Beauty Bastos');
    notifier = new InMemoryInvitationNotifier();
    audit = new InMemoryAuditTrail();
    afterCommit = new FakeAfterCommit();
    clock = new FixedClock(NOW);
    handler = new InviteCollaboratorHandler(
      invitations,
      checks,
      new RoleGrantPolicy((role) => (role === 'FINANCE_MANAGER' ? ['finances:view'] : [])),
      notifier,
      audit,
      afterCommit.asAfterCommit(),
      clock,
      new SequentialIdGenerator(),
    );
  });

  const invite = (
    over: { phone?: string; name?: string; role?: SalonRole; permissions?: string[]; salonId?: string } = {},
  ) =>
    handler.execute(
      new InviteCollaborator(
        over.salonId ?? AKWA_ID,
        MIREILLE_ID,
        over.permissions ?? OWNER_PERMISSIONS,
        over.name ?? 'Brice Nana',
        over.phone ?? '6 55 44 33 22',
        over.role ?? 'HAIRDRESSER',
      ),
    );
  /** Invitations déjà envoyées par un salon, à des numéros distincts. */
  const seed = async (count: number, salonId: string, now = NOW, notifyBySms = false) => {
    for (let n = 0; n < count; n++)
      await invitations.add(
        anInvitation({
          id: `0195f000-0000-7000-8000-0000000e${String(n).padStart(4, '0')}`,
          salonId,
          phone: phoneN(n),
          now,
          notifyBySms,
        }),
      );
  };
  const cancelAll = () => {
    for (const [id, row] of invitations.rows) invitations.rows.set(id, { ...row, status: 'CANCELLED' });
  };
  const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

  describe('refusals', () => {
    it('refuses a role that gives more rights than the author holds in this salon', async () => {
      await expect(invite({ role: 'FINANCE_MANAGER', permissions: ['staff:invite'] })).rejects.toThrow(
        RoleAboveInviterError,
      );
      expect(invitations.all()).toHaveLength(0);
    });

    it('refuses a number that is already an active member of the salon', async () => {
      checks.withMember(AKWA_ID, BRICE_PHONE);

      await expect(invite()).rejects.toThrow(AlreadySalonMemberError);
      await afterCommit.commit();
      expect(notifier.sent).toHaveLength(0);
      expect(invitations.all()).toHaveLength(0);
    });

    it('accepts a number that is a member of another salon only', async () => {
      checks.withMember(ELEGANCE_ID, BRICE_PHONE);

      await expect(invite()).resolves.toMatchObject({ phone: BRICE_PHONE });
    });

    it('refuses a number with an invitation still pending in the salon, which stays unchanged', async () => {
      await invite({ role: 'FINANCE_MANAGER' });

      await expect(invite({ role: 'HAIRDRESSER' })).rejects.toThrow(InvitationAlreadyPendingError);
      expect(invitations.all().map((r) => [r.role, r.status])).toEqual([['FINANCE_MANAGER', 'PENDING']]);
    });

    it('invites again once the previous invitation has expired, and marks the old one as expired', async () => {
      const previous = anInvitation({ now: new Date(NOW.getTime() - 9 * DAY_MS) });
      await invitations.add(previous);

      await invite();

      expect(invitations.all().map((r) => r.status)).toEqual(['EXPIRED', 'PENDING']);
    });

    it('invites the same number in two different salons, each with its own invitation', async () => {
      await invite({ salonId: BASTOS_ID });
      await invite({ salonId: AKWA_ID });

      expect(invitations.ofSalon(AKWA_ID)).toHaveLength(1);
      expect(invitations.ofSalon(BASTOS_ID)).toHaveLength(1);
    });

    it('refuses an invalid phone number without recording anything', async () => {
      await expect(invite({ phone: '6 55 44 33 2' })).rejects.toThrow(InvalidValueError);
      expect(invitations.all()).toHaveLength(0);
    });

    it('refuses an invitation contract whose name only reaches 2 characters with invisible or control characters', () => {
      const parsed = InviteCollaboratorSchema.safeParse({
        name: 'B\u200B',
        phone: '6 55 44 33 22',
        role: 'HAIRDRESSER',
      });

      expect(parsed.success).toBe(false);
    });
  });

  describe('limits against abusive sending', () => {
    it('accepts the 20th invitation of the salon within 24 hours', async () => {
      await seed(19, AKWA_ID, hoursAgo(24));

      await expect(invite()).resolves.toBeDefined();
    });

    it('refuses the 21st invitation of the salon within 24 hours', async () => {
      await seed(20, AKWA_ID, hoursAgo(24));

      await expect(invite()).rejects.toThrow(InvitationQuotaReachedError);
    });

    it('does not count the invitations sent more than 24 hours ago', async () => {
      await seed(20, AKWA_ID, new Date(hoursAgo(24).getTime() - 1000));

      await expect(invite()).resolves.toBeDefined();
    });

    it('refuses a 51st invitation pending in the salon', async () => {
      await seed(50, AKWA_ID, hoursAgo(48));

      await expect(invite()).rejects.toThrow(PendingInvitationsLimitError);
    });

    it('does not count the invitations of other salons', async () => {
      await seed(20, BASTOS_ID, hoursAgo(1));

      await expect(invite()).resolves.toBeDefined();
    });

    it('records the invitation without any SMS once the number has received 3 SMS in 24 hours, with the same answer', async () => {
      const reference = await invite({ phone: '6 70 11 22 33' });
      await afterCommit.commit();
      for (let n = 0; n < 3; n++)
        await invitations.add(
          anInvitation({
            id: `0195f000-0000-7000-8000-0000000f000${n}`,
            salonId: `0195f000-0000-7000-8000-00000000c10${n}`,
            phone: BRICE_PHONE,
            now: hoursAgo(24),
            notifyBySms: true,
          }),
        );
      notifier.sent.length = 0;

      const answer = await invite();
      await afterCommit.commit();

      expect(invitations.ofSalon(AKWA_ID).map((r) => r.phone)).toContain(BRICE_PHONE);
      expect(notifier.sent).toHaveLength(0);
      expect(Object.keys(answer)).toEqual(Object.keys(reference));
    });
  });

  describe('the answer and the SMS', () => {
    it('answers with the invitation and its deadline, 7 days after the sending', async () => {
      const answer = await invite({ name: '   Brice    Nana  ' });

      expect(answer).toEqual({
        invitationId: '00000000-0000-7000-8000-000000000001',
        name: 'Brice Nana',
        phone: BRICE_PHONE,
        role: 'HAIRDRESSER',
        expiresAt: '2026-11-26T09:00:00.000Z',
      });
    });

    it('sends the fixed information SMS, without any code, only after the commit', async () => {
      await invite();
      expect(notifier.sent).toHaveLength(0);

      await afterCommit.commit();

      expect(notifier.sent).toEqual([{ to: BRICE_PHONE, text: SMS_TEXT }]);
      expect(notifier.sent[0]!.text).not.toMatch(/\d{4,}/);
    });

    it('sends no SMS when the invitation is refused', async () => {
      checks.withMember(AKWA_ID, BRICE_PHONE);
      await invite().catch(() => undefined);

      await afterCommit.commit();

      expect(notifier.sent).toHaveLength(0);
    });

    it('keeps the invitation when the SMS provider is down, without letting the failure out', async () => {
      notifier.outage = true;
      await invite();

      await expect(afterCommit.commit()).resolves.toBeUndefined();

      expect(invitations.all().map((r) => r.status)).toEqual(['PENDING']);
    });

    it('gives the same answer shape and the same text for a number with or without an account elsewhere', async () => {
      checks.withMember(ELEGANCE_ID, '+237699001122');

      const noAccount = await invite({ phone: '6 55 44 33 22' });
      const staffAccount = await invite({ phone: '6 99 00 11 22' });
      await afterCommit.commit();

      expect(Object.keys(staffAccount)).toEqual(Object.keys(noAccount));
      expect(notifier.sent.map((s) => s.text)).toEqual([SMS_TEXT, SMS_TEXT]);
    });

    it('never puts a text typed by the salon into the SMS, whatever the name of the salon or of the invited person', async () => {
      checks.withSalon(AKWA_ID, 'MoMo: compte bloqué, rappelez le 677 99 99 99');
      await invite({ name: 'MoMo: compte bloqué, rappelez le 677 00 00 00' });

      await afterCommit.commit();

      expect(notifier.sent).toEqual([{ to: BRICE_PHONE, text: SMS_TEXT }]);
    });

    it('does not let a salon that invites, cancels and invites again use up the 3 SMS of a number', async () => {
      for (let n = 0; n < 3; n++) {
        await invitations.add(
          anInvitation({
            id: `0195f000-0000-7000-8000-0000000f010${n}`,
            salonId: BASTOS_ID,
            phone: BRICE_PHONE,
            now: hoursAgo(n + 1),
            notifyBySms: true,
          }),
        );
        cancelAll();
      }

      await invite();
      await afterCommit.commit();

      expect(notifier.sent).toHaveLength(1);
    });
  });

  describe('concurrent requests', () => {
    it('takes the lock of the salon, then the lock of the number, before reading any counter', async () => {
      await invite();

      expect(checks.locks).toEqual([`salon:${AKWA_ID}`, `phone:${BRICE_PHONE}`]);
    });
  });

  describe('the audit trail', () => {
    it('records who invited in which salon with which role, without name or number', async () => {
      await invite();

      expect(audit.entries).toEqual([
        {
          action: 'COLLABORATOR_INVITED',
          subjectType: 'salon_invitation',
          subjectId: '00000000-0000-7000-8000-000000000001',
          actorUserId: MIREILLE_ID,
          salonId: AKWA_ID,
          occurredAt: NOW,
          details: { role: 'HAIRDRESSER' },
        },
      ]);
      expect(JSON.stringify(audit.entries)).not.toContain('Brice');
      expect(JSON.stringify(audit.entries)).not.toContain('6554');
    });

    it('leaves no audit line after a refusal', async () => {
      checks.withMember(AKWA_ID, BRICE_PHONE);
      await invite().catch(() => undefined);

      expect(audit.entries).toHaveLength(0);
    });
  });
});
