import { beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '../../../../test-support/fakes.js';
import { CancelInvitation } from '../../application/commands/cancel-invitation/cancel-invitation.command.js';
import { CancelInvitationHandler } from '../../application/commands/cancel-invitation/cancel-invitation.handler.js';
import { InvitationNoLongerPendingError } from '../../domain/exceptions/invitation-no-longer-pending.error.js';
import { InvitationNotFoundError } from '../../domain/exceptions/invitation-not-found.error.js';
import { RoleAboveInviterError } from '../../domain/exceptions/role-above-inviter.error.js';
import { RoleGrantPolicy } from '../../domain/services/role-grant-policy.js';
import { AKWA_ID, anInvitation, BASTOS_ID, DAY_MS, NOW } from '../builders/invitation-builders.js';
import { MIREILLE_ID } from '../builders/organization-builders.js';
import { InMemoryInvitationRepository } from '../fakes/invitation-fakes.js';
import { InMemoryAuditTrail } from '../fakes/organization-fakes.js';

const INVITATION_ID = '0195f000-0000-7000-8000-00000000d001';

describe('Cancelling an invitation', () => {
  let invitations: InMemoryInvitationRepository;
  let audit: InMemoryAuditTrail;
  let clock: FixedClock;
  let handler: CancelInvitationHandler;

  beforeEach(() => {
    invitations = new InMemoryInvitationRepository();
    audit = new InMemoryAuditTrail();
    clock = new FixedClock(new Date(NOW.getTime() + DAY_MS));
    handler = new CancelInvitationHandler(
      invitations,
      new RoleGrantPolicy((role) => (role === 'FINANCE_MANAGER' ? ['finances:view'] : [])),
      audit,
      clock,
    );
  });

  const cancel = (over: { salonId?: string; id?: string; permissions?: string[] } = {}) =>
    handler.execute(
      new CancelInvitation(
        over.salonId ?? AKWA_ID,
        MIREILLE_ID,
        over.permissions ?? ['staff:invite', 'finances:view'],
        over.id ?? INVITATION_ID,
      ),
    );

  it('cancels a pending invitation, which can no longer be accepted', async () => {
    await invitations.add(anInvitation());

    await expect(cancel()).resolves.toEqual({ invitationId: INVITATION_ID, status: 'CANCELLED' });

    expect(invitations.all().map((r) => r.status)).toEqual(['CANCELLED']);
  });

  it('refuses an invitation that has expired', async () => {
    await invitations.add(anInvitation({ now: new Date(NOW.getTime() - 8 * DAY_MS) }));

    await expect(cancel()).rejects.toThrow(InvitationNoLongerPendingError);
  });

  it('refuses an invitation that was already cancelled', async () => {
    await invitations.add(anInvitation());
    await cancel();

    await expect(cancel()).rejects.toThrow(InvitationNoLongerPendingError);
  });

  it('refuses an invitation that was accepted', async () => {
    await invitations.add(anInvitation());
    invitations.rows.set(INVITATION_ID, { ...invitations.rows.get(INVITATION_ID)!, status: 'ACCEPTED' });

    await expect(cancel()).rejects.toThrow(InvitationNoLongerPendingError);
  });

  it('answers an invitation of another salon exactly as an invitation that does not exist', async () => {
    await invitations.add(anInvitation({ salonId: BASTOS_ID }));
    const refusal = async (id: string) =>
      cancel({ id }).then(
        () => {
          throw new Error('Expected a refusal');
        },
        (error: InvitationNotFoundError) => error,
      );

    const foreign = await refusal(INVITATION_ID);
    const missing = await refusal('0195f000-0000-7000-8000-00000000dead');

    expect(foreign).toBeInstanceOf(InvitationNotFoundError);
    expect({ code: foreign.code, message: foreign.message }).toEqual({
      code: missing.code,
      message: missing.message,
    });
    expect(invitations.all().map((r) => r.status)).toEqual(['PENDING']);
  });

  it('refuses an author who does not hold the rights of the invited role', async () => {
    await invitations.add(anInvitation({ role: 'FINANCE_MANAGER' }));

    await expect(cancel({ permissions: ['staff:invite'] })).rejects.toThrow(RoleAboveInviterError);
    expect(invitations.all().map((r) => r.status)).toEqual(['PENDING']);
  });

  it('records the cancellation in the audit trail without name or number, and nothing after a refusal', async () => {
    await invitations.add(anInvitation());
    await cancel({ id: '0195f000-0000-7000-8000-00000000dead' }).catch(() => undefined);
    expect(audit.entries).toHaveLength(0);

    await cancel();

    expect(audit.entries).toEqual([
      {
        action: 'INVITATION_CANCELLED',
        subjectType: 'salon_invitation',
        subjectId: INVITATION_ID,
        actorUserId: MIREILLE_ID,
        salonId: AKWA_ID,
        occurredAt: clock.now(),
        details: { role: 'HAIRDRESSER' },
      },
    ]);
    expect(JSON.stringify(audit.entries)).not.toContain('Brice');
  });
});
