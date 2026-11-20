import { describe, expect, it } from 'vitest';
import { Invitation } from '../../domain/aggregates/invitation.js';
import { InvitationAccepted } from '../../domain/events/invitation-accepted.js';
import { InvitationNoLongerPendingError } from '../../domain/exceptions/invitation-no-longer-pending.error.js';
import { anInvitation, DAY_MS, NOW } from '../builders/invitation-builders.js';

const BRICE_USER_ID = '0195f000-0000-7000-8000-00000000e001';
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

describe('Accepting an invitation to join a salon', () => {
  it('marks a pending invitation accepted and erases the name and the number the salon typed', () => {
    const invitation = anInvitation();

    invitation.accept(BRICE_USER_ID, at(DAY_MS));

    expect(invitation.snapshot()).toMatchObject({
      status: 'ACCEPTED',
      endedAt: at(DAY_MS),
      acceptedByUserId: BRICE_USER_ID,
      name: null,
      phone: null,
      role: 'HAIRDRESSER',
    });
  });

  it('records the fact with identifiers and role only, never the name or the number', () => {
    const invitation = anInvitation();
    invitation.pullEvents();

    invitation.accept(BRICE_USER_ID, at(DAY_MS));

    const [event] = invitation.pullEvents();
    expect(event).toBeInstanceOf(InvitationAccepted);
    expect(event).toMatchObject({
      salonId: invitation.snapshot().salonId,
      role: 'HAIRDRESSER',
      userId: BRICE_USER_ID,
    });
    expect(JSON.stringify(event)).not.toMatch(/Brice|655443322/);
  });

  it('accepts up to the last second before the deadline and refuses at the deadline itself', () => {
    const lastSecond = anInvitation();
    lastSecond.accept(BRICE_USER_ID, at(7 * DAY_MS - 1000));
    expect(lastSecond.snapshot().status).toBe('ACCEPTED');

    expect(() => anInvitation().accept(BRICE_USER_ID, at(7 * DAY_MS))).toThrow(
      InvitationNoLongerPendingError,
    );
  });

  it.each([['CANCELLED'], ['EXPIRED'], ['ACCEPTED']] as const)(
    'refuses an invitation that is %s',
    (status) => {
      const ended = Invitation.restore({ ...anInvitation().snapshot(), status });

      expect(() => ended.accept(BRICE_USER_ID, at(1000))).toThrow(InvitationNoLongerPendingError);
    },
  );
});
