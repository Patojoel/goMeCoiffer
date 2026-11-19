import { describe, expect, it } from 'vitest';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import { Invitation } from '../../domain/aggregates/invitation.js';
import { CollaboratorInvited } from '../../domain/events/collaborator-invited.js';
import { InvitationCancelled } from '../../domain/events/invitation-cancelled.js';
import { InvitationNoLongerPendingError } from '../../domain/exceptions/invitation-no-longer-pending.error.js';
import { OwnerRoleNotInvitableError } from '../../domain/exceptions/owner-role-not-invitable.error.js';
import { InviteeName } from '../../domain/value-objects/invitee-name.js';
import { anInvitation, BRICE_PHONE, DAY_MS, NOW } from '../builders/invitation-builders.js';
import { MIREILLE_ID } from '../builders/organization-builders.js';

const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

describe('Issuing an invitation to join a salon', () => {
  describe('the name of the invited person', () => {
    it.each([['B'], [''], ['   '], ['x'.repeat(81)]])('refuses the name %j', (raw) => {
      expect(() => InviteeName.create(raw)).toThrow(InvalidValueError);
    });

    it.each([['Bo'], ['x'.repeat(80)]])('accepts the name %j', (raw) => {
      expect(InviteeName.create(raw).value).toBe(raw);
    });

    it.each([
      ['a right-to-left override', 'Brice \u202ENana', 'Brice Nana'],
      ['an isolate', 'Brice \u2066Nana\u2069', 'Brice Nana'],
      ['a zero-width space', 'Brice\u200B Nana', 'Brice Nana'],
      ['a byte order mark', '\uFEFFBrice Nana', 'Brice Nana'],
      ['a control character', 'Brice\u0007 Nana', 'Brice Nana'],
    ])('removes %s from the name', (_label, raw, expected) => {
      expect(InviteeName.create(raw).value).toBe(expected);
    });

    it('counts the length of the name after removing the invisible characters', () => {
      expect(() => InviteeName.create('B\u200B\u200C\u200D')).toThrow(InvalidValueError);
    });

    it('trims the name and collapses inner spaces', () => {
      expect(InviteeName.create('   Brice    Nana  ').value).toBe('Brice Nana');
    });
  });

  describe('the role', () => {
    it.each([['SALON_ADMIN'], ['HAIRDRESSER'], ['FINANCE_MANAGER'], ['PRACTITIONER']] as const)(
      'accepts the collaborator role %s',
      (role) => {
        expect(anInvitation({ role }).snapshot().role).toBe(role);
      },
    );

    it('never gives the Owner role, even when the contract is bypassed', () => {
      expect(() => anInvitation({ role: 'OWNER' })).toThrow(OwnerRoleNotInvitableError);
    });

    it.each([['ESTHETICIAN'], ['PLATFORM_ADMIN']])('refuses the unknown role %s', (role) => {
      expect(() => anInvitation({ role: role as never })).toThrow(InvalidValueError);
    });
  });

  describe('a new invitation', () => {
    it('is pending for 7 days from its sending and records who invited, without any trace of the invitee', () => {
      const invitation = anInvitation();

      expect(invitation.snapshot()).toMatchObject({
        status: 'PENDING',
        name: 'Brice Nana',
        phone: BRICE_PHONE,
        role: 'HAIRDRESSER',
        invitedByUserId: MIREILLE_ID,
        sentAt: NOW,
        expiresAt: new Date('2026-11-26T10:00:00+01:00'),
        endedAt: null,
      });
      const [event] = invitation.pullEvents();
      expect(event).toBeInstanceOf(CollaboratorInvited);
      expect(JSON.stringify(event)).not.toContain('Brice');
      expect(JSON.stringify(event)).not.toContain('6554');
    });

    it('normalises the phone number to the international format', () => {
      expect(anInvitation({ phone: '6 55 44 33 22' }).snapshot().phone).toBe(BRICE_PHONE);
    });

    it('is still pending one second before 7 days, expired at 7 days', () => {
      const invitation = anInvitation();

      expect(invitation.isPendingAt(at(7 * DAY_MS - 1000))).toBe(true);
      expect(invitation.isPendingAt(at(7 * DAY_MS))).toBe(false);
    });

    it('becomes expired, with its end at the deadline, once the deadline has passed', () => {
      const invitation = anInvitation();

      expect(invitation.expireIfDue(at(7 * DAY_MS - 1000))).toBe(false);
      expect(invitation.expireIfDue(at(8 * DAY_MS))).toBe(true);
      expect(invitation.snapshot()).toMatchObject({ status: 'EXPIRED', endedAt: at(7 * DAY_MS) });
    });
  });

  describe('cancelling', () => {
    it('cancels a pending invitation and records the fact without any trace of the invitee', () => {
      const invitation = anInvitation();
      invitation.pullEvents();

      invitation.cancel(MIREILLE_ID, at(DAY_MS));

      expect(invitation.snapshot()).toMatchObject({ status: 'CANCELLED', endedAt: at(DAY_MS) });
      const [event] = invitation.pullEvents();
      expect(event).toBeInstanceOf(InvitationCancelled);
      expect(JSON.stringify(event)).not.toContain('Brice');
    });

    it('refuses to cancel an invitation that has expired', () => {
      expect(() => anInvitation().cancel(MIREILLE_ID, at(7 * DAY_MS))).toThrow(
        InvitationNoLongerPendingError,
      );
    });

    it('refuses to cancel an invitation that is already cancelled', () => {
      const invitation = anInvitation();
      invitation.cancel(MIREILLE_ID, at(1000));

      expect(() => invitation.cancel(MIREILLE_ID, at(2000))).toThrow(InvitationNoLongerPendingError);
    });

    it('refuses to cancel an invitation that was accepted', () => {
      const accepted = Invitation.restore({ ...anInvitation().snapshot(), status: 'ACCEPTED' });

      expect(() => accepted.cancel(MIREILLE_ID, at(1000))).toThrow(InvitationNoLongerPendingError);
    });
  });
});
