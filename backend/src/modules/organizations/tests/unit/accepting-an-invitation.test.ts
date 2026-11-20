import { beforeEach, describe, expect, it } from 'vitest';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { AcceptInvitation } from '../../application/commands/accept-invitation/accept-invitation.command.js';
import { AcceptInvitationHandler } from '../../application/commands/accept-invitation/accept-invitation.handler.js';
import { AccountStateChangedError } from '../../domain/exceptions/account-state-changed.error.js';
import { AlreadySalonMemberError } from '../../domain/exceptions/already-salon-member.error.js';
import { InvitationNoLongerPendingError } from '../../domain/exceptions/invitation-no-longer-pending.error.js';
import { InvitationNotFoundError } from '../../domain/exceptions/invitation-not-found.error.js';
import { OwnerRoleReservedError } from '../../domain/exceptions/owner-role-reserved.error.js';
import { PhoneProofRequiredError } from '../../domain/exceptions/phone-proof-required.error.js';
import {
  AKWA_ID,
  anInvitation,
  BRICE_PHONE,
  DAY_MS,
  ELEGANCE_ID,
  NOW,
} from '../builders/invitation-builders.js';
import {
  InMemoryInvitationChecks,
  InMemoryInvitationRepository,
  InMemoryInviteeAccounts,
  InMemoryPhoneProofs,
} from '../fakes/invitation-fakes.js';
import { InMemoryAuditTrail, InMemorySalonMembershipRepository } from '../fakes/organization-fakes.js';

const BRICE_AKWA = '0195f000-0000-7000-8000-00000000d001';
const BRICE_ELEGANCE = '0195f000-0000-7000-8000-00000000d002';
const PAUL_AKWA = '0195f000-0000-7000-8000-00000000d003';
const PAUL_PHONE = '+237699001122';
const PAUL_ID = '0195f000-0000-7000-8000-00000000b002';
const MIREILLE_ID = '0195f000-0000-7000-8000-00000000b001';
const TOKEN = 'proof-token';
const DETAILS = { name: 'Brice Nana', password: 'Wouri-Barber-2027', termsAccepted: true } as const;
const SESSION_MAX_AGE_HOURS = 12;
const HOUR_MS = 3_600_000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

describe('Accepting an invitation to join a salon', () => {
  let clock: FixedClock;
  let invitations: InMemoryInvitationRepository;
  let checks: InMemoryInvitationChecks;
  let proofs: InMemoryPhoneProofs;
  let accounts: InMemoryInviteeAccounts;
  let memberships: InMemorySalonMembershipRepository;
  let audit: InMemoryAuditTrail;
  let handler: AcceptInvitationHandler;

  beforeEach(async () => {
    clock = new FixedClock(at(DAY_MS));
    invitations = new InMemoryInvitationRepository();
    checks = new InMemoryInvitationChecks(invitations)
      .withSalon(AKWA_ID, 'Go Beauty Akwa')
      .withSalon(ELEGANCE_ID, 'Élégance Bonamoussadi');
    proofs = new InMemoryPhoneProofs().prove(TOKEN, BRICE_PHONE, at(DAY_MS - 120_000));
    accounts = new InMemoryInviteeAccounts();
    memberships = new InMemorySalonMembershipRepository();
    audit = new InMemoryAuditTrail();
    handler = new AcceptInvitationHandler(
      proofs,
      invitations,
      checks,
      accounts,
      memberships,
      audit,
      clock,
      new SequentialIdGenerator(),
    );
    await invitations.add(anInvitation({ id: BRICE_AKWA, role: 'HAIRDRESSER' }));
    await invitations.add(anInvitation({ id: BRICE_ELEGANCE, salonId: ELEGANCE_ID, role: 'SALON_ADMIN' }));
    await invitations.add(
      anInvitation({ id: PAUL_AKWA, name: 'Paul Ebode', phone: PAUL_PHONE, role: 'SALON_ADMIN' }),
    );
  });

  const accept = (over: Partial<ConstructorParameters<typeof AcceptInvitation>[0]> = {}) =>
    handler.execute(
      new AcceptInvitation({
        invitationId: BRICE_AKWA,
        proofToken: TOKEN,
        details: DETAILS,
        session: null,
        sessionMaxAgeHours: SESSION_MAX_AGE_HOURS,
        ...over,
      }),
    );
  const pendingIds = () =>
    invitations
      .all()
      .filter((r) => r.status === 'PENDING')
      .map((r) => r.id);

  describe('proof of the number', () => {
    it.each([
      ['no proof at all', { proofToken: null }],
      ['a proof this browser never received', { proofToken: 'someone-elses' }],
    ])('refuses to accept with %s, creating nothing', async (_label, over) => {
      await expect(accept(over)).rejects.toThrow(PhoneProofRequiredError);

      expect(accounts.provided).toEqual([]);
      expect(memberships.rows).toEqual([]);
      expect(pendingIds()).toHaveLength(3);
    });

    it('accepts up to the last second of the proof and refuses at 15 minutes', async () => {
      clock.set(at(DAY_MS - 120_000 + 15 * 60_000 - 1000));
      await expect(accept()).resolves.toBeDefined();

      clock.set(at(DAY_MS - 120_000 + 15 * 60_000));
      await expect(accept({ invitationId: BRICE_ELEGANCE, details: null })).rejects.toThrow(
        PhoneProofRequiredError,
      );
    });
  });

  describe('the invitation aimed at', () => {
    it('answers the same "not found" for an invitation of another number and for an unknown one', async () => {
      const ofPaul = await accept({ invitationId: PAUL_AKWA }).catch((e: Error) => e);
      const unknown = await accept({ invitationId: '0195f000-0000-7000-8000-00000000dead' }).catch(
        (e: Error) => e,
      );

      expect(ofPaul).toBeInstanceOf(InvitationNotFoundError);
      expect(ofPaul).toEqual(unknown);
      expect(pendingIds()).toContain(PAUL_AKWA);
      expect(accounts.provided).toEqual([]);
    });

    it('refuses an invitation that expired, creating no account', async () => {
      clock.set(at(7 * DAY_MS));
      proofs.prove(TOKEN, BRICE_PHONE, at(7 * DAY_MS - 60_000));

      await expect(accept()).rejects.toThrow(InvitationNoLongerPendingError);

      expect(accounts.provided).toEqual([]);
    });

    it('refuses an invitation cancelled meanwhile', async () => {
      const cancelled = await invitations.getOfSalon(AKWA_ID, BRICE_AKWA);
      cancelled.cancel(MIREILLE_ID, clock.now());
      await invitations.save(cancelled);

      await expect(accept()).rejects.toThrow(InvitationNoLongerPendingError);
    });

    it('says "no longer pending" to the person who already accepted it, not "not found"', async () => {
      await accept();
      invitations.accountPhones.set(accounts.idOf(BRICE_PHONE)!, BRICE_PHONE);

      await expect(accept({ details: null })).rejects.toThrow(InvitationNoLongerPendingError);
    });
  });

  describe('a person without an account', () => {
    it('creates the account, joins the salon with the role of the invitation and erases what the salon typed', async () => {
      const done = await accept();

      const userId = accounts.idOf(BRICE_PHONE)!;
      expect(accounts.provided).toEqual([
        { phone: BRICE_PHONE, details: DETAILS, provenAt: at(DAY_MS - 120_000) },
      ]);
      expect(memberships.rows).toMatchObject([
        { salonId: AKWA_ID, userId, role: 'HAIRDRESSER', status: 'ACTIVE', grantedAt: clock.now() },
      ]);
      expect(invitations.rows.get(BRICE_AKWA)).toMatchObject({
        status: 'ACCEPTED',
        acceptedByUserId: userId,
        endedAt: clock.now(),
        name: null,
        phone: null,
      });
      expect(done).toEqual({
        userId,
        credentialsVersion: 1,
        salonId: AKWA_ID,
        salonName: 'Go Beauty Akwa',
        session: 'OPEN_NEW',
        proofEnded: false,
      });
    });

    it('traces the acceptance without the name, the number or any secret', async () => {
      await accept();

      expect(audit.entries).toEqual([
        {
          action: 'INVITATION_ACCEPTED',
          subjectType: 'salon_invitation',
          subjectId: BRICE_AKWA,
          actorUserId: accounts.idOf(BRICE_PHONE),
          salonId: AKWA_ID,
          occurredAt: clock.now(),
          details: { role: 'HAIRDRESSER' },
        },
      ]);
      expect(JSON.stringify(audit.entries)).not.toMatch(/Brice|655443322|Wouri/);
    });

    it('refuses account details when the account already exists, and the reverse', async () => {
      accounts.withStaffAccount(BRICE_PHONE, PAUL_ID);

      await expect(accept()).rejects.toThrow(AccountStateChangedError);
      await expect(accept({ details: null })).resolves.toBeDefined();
    });
  });

  describe('a person who already has a staff account', () => {
    beforeEach(() => {
      accounts.withStaffAccount(PAUL_PHONE, PAUL_ID);
      proofs.prove('paul-proof', PAUL_PHONE, at(DAY_MS - 60_000));
    });
    const signedInAs = (userId: string, credentialsVersion: number | null, ageMs = HOUR_MS) => ({
      userId,
      credentialsVersion,
      authenticatedAt: at(DAY_MS).getTime() - ageMs as number | null,
    });
    const acceptAsPaul = (session: ReturnType<typeof signedInAs> | null) =>
      accept({ invitationId: PAUL_AKWA, proofToken: 'paul-proof', details: null, session });

    it('joins the salon in one click, leaving the account untouched', async () => {
      await acceptAsPaul(null);

      expect(accounts.provided).toEqual([
        { phone: PAUL_PHONE, details: null, provenAt: at(DAY_MS - 60_000) },
      ]);
      expect(memberships.rows).toMatchObject([{ salonId: AKWA_ID, userId: PAUL_ID, role: 'SALON_ADMIN' }]);
    });

    it.each([
      [
        'regenerates the session of the account already signed in here',
        signedInAs(PAUL_ID, 1),
        'REGENERATE',
      ],
      [
        'regenerates a session that carries no version, the initial one',
        signedInAs(PAUL_ID, null),
        'REGENERATE',
      ],
      [
        'leaves alone a session whose credentials are out of date',
        signedInAs(PAUL_ID, 0),
        'NONE',
      ],
      ['leaves alone the session of another account', signedInAs(MIREILLE_ID, 1), 'NONE'],
      ['regenerates a session on its last allowed millisecond', signedInAs(PAUL_ID, 1, SESSION_MAX_AGE_HOURS * HOUR_MS), 'REGENERATE'],
      ['leaves alone a session past its absolute duration', signedInAs(PAUL_ID, 1, SESSION_MAX_AGE_HOURS * HOUR_MS + 1), 'NONE'],
      ['leaves alone a session that does not say when it was opened', { userId: PAUL_ID, credentialsVersion: 1, authenticatedAt: null }, 'NONE'],
      ['opens no session when nobody is signed in', null, 'NONE'],
    ] as const)('%s', async (_label, session, expected) => {
      const done = await acceptAsPaul(session);

      expect(done.session).toBe(expected);
    });

    it('gives the membership to the owner of the proven number, never to the account signed in here', async () => {
      await acceptAsPaul(signedInAs(MIREILLE_ID, 1));

      expect(memberships.rows.map((r) => r.userId)).toEqual([PAUL_ID]);
    });

    it('refuses a second membership in the same salon, leaving the invitation pending', async () => {
      checks.withMember(AKWA_ID, PAUL_PHONE);

      const refusal = await acceptAsPaul(null).catch((e: Error) => e);

      expect(refusal).toBeInstanceOf(AlreadySalonMemberError);
      expect(refusal).toMatchObject({ message: expect.stringContaining('Vous faites déjà partie') });
      expect(pendingIds()).toContain(PAUL_AKWA);
      expect(accounts.provided).toEqual([]);
    });
  });

  describe('the proof once the last pending invitation is accepted', () => {
    it('forgets every proof of the number, and says so, when no other invitation is pending for it', async () => {
      accounts.withStaffAccount(PAUL_PHONE, PAUL_ID);
      proofs.prove('paul-proof', PAUL_PHONE, at(DAY_MS - 60_000));

      const done = await accept({ invitationId: PAUL_AKWA, proofToken: 'paul-proof', details: null });

      expect(done.proofEnded).toBe(true);
      expect(proofs.forgotten).toEqual([PAUL_PHONE]);
    });

    it('keeps the proof while another invitation of the number is still pending', async () => {
      const done = await accept({ invitationId: BRICE_AKWA });

      expect(done.proofEnded).toBe(false);
      expect(proofs.forgotten).toEqual([]);
    });

    it('does not count an invitation that has expired as pending', async () => {
      invitations.rows.set(BRICE_ELEGANCE, { ...invitations.rows.get(BRICE_ELEGANCE)!, expiresAt: at(DAY_MS - 1) });

      expect((await accept({ invitationId: BRICE_AKWA })).proofEnded).toBe(true);
    });
  });

  it('never makes an owner of an invitation forged with the owner role', async () => {
    invitations.rows.set(BRICE_AKWA, { ...invitations.rows.get(BRICE_AKWA)!, role: 'OWNER' });

    await expect(accept()).rejects.toThrow(OwnerRoleReservedError);
  });

  it('accepts one invitation at a time: the other stays pending and the second acceptance asks for nothing', async () => {
    await accept({ invitationId: BRICE_AKWA });
    expect(pendingIds()).toContain(BRICE_ELEGANCE);

    const second = await accept({ invitationId: BRICE_ELEGANCE, details: null });

    expect(accounts.provided.at(-1)).toMatchObject({ details: null });
    expect(second).toMatchObject({ salonId: ELEGANCE_ID, session: 'NONE' });
    expect(memberships.rows.map((r) => [r.salonId, r.role])).toEqual([
      [AKWA_ID, 'HAIRDRESSER'],
      [ELEGANCE_ID, 'SALON_ADMIN'],
    ]);
  });

  it('takes the lock of the proven number before reading the invitation', async () => {
    await accept();

    expect(checks.locks).toEqual([`phone:${BRICE_PHONE}`]);
  });

  it.todo(
    'completes a light client account instead of duplicating it @apres-UC-009 (provider tested in identity)',
  );
  it.todo('re-activates a membership removed earlier @apres-UC-008');
});
