import { Injectable } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CLOCK } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { PhoneProof, proofTokenSecret } from '../../../identity/domain/aggregates/phone-proof.js';
import { SECRET_HASHER, type SecretHasher } from '../../../identity/domain/ports/secret-hasher.port.js';
import {
  PHONE_PROOF_REPOSITORY,
  type PhoneProofRepository,
} from '../../../identity/domain/repositories/write/phone-proof.repository.js';
import { AcceptInvitation } from '../../application/commands/accept-invitation/accept-invitation.command.js';
import { CancelInvitation } from '../../application/commands/cancel-invitation/cancel-invitation.command.js';
import { Invitation } from '../../domain/aggregates/invitation.js';
import { InvitationAccepted } from '../../domain/events/invitation-accepted.js';
import { InvitationNoLongerPendingError } from '../../domain/exceptions/invitation-no-longer-pending.error.js';
import { InvitationNotFoundError } from '../../domain/exceptions/invitation-not-found.error.js';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../domain/repositories/write/invitation.repository.js';
import { anInvitation, DAY_MS, NOW } from '../builders/invitation-builders.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { StaffAccounts } from '../builders/staff-accounts.js';

const failure = { armed: false };

/** Simule une panne après la création du compte : le subscriber s'exécute dans la transaction de la commande. */
@Injectable()
class WhenInvitationAcceptedFailing {
  readonly subscribesTo = InvitationAccepted;
  handle() {
    if (failure.armed) throw new Error('database down');
  }
}

const DETAILS = { name: 'Brice Nana', password: 'Wouri-Barber-2027', termsAccepted: true } as const;
let counter = 0;
const nextId = () => `0195f000-0000-7000-8000-0000000c${String(++counter).padStart(4, '0')}`;
let phones = 0;
const nextPhone = () => `+2376500${String(++phones).padStart(5, '0')}`;

describe('Accepting an invitation in PostgreSQL', () => {
  let t: TestApp;
  let db: DataSource;
  let bus: TransactionalCommandBus;
  let invitations: InvitationRepository;
  let proofs: PhoneProofRepository;
  let hasher: SecretHasher;
  let clock: FixedClock;
  let akwa: WorldSalon;
  let elegance: WorldSalon;
  let authorId: string;

  beforeAll(async () => {
    clock = new FixedClock(new Date(NOW.getTime() + DAY_MS));
    t = await startTestApp({ providers: [WhenInvitationAcceptedFailing], overrides: [[CLOCK, clock]] });
    db = t.moduleRef.get(getDataSourceToken());
    bus = t.moduleRef.get(TransactionalCommandBus);
    invitations = t.moduleRef.get(INVITATION_REPOSITORY);
    proofs = t.moduleRef.get(PHONE_PROOF_REPOSITORY);
    hasher = t.moduleRef.get(SECRET_HASHER);
    const mireille = await new StaffAccounts(db).create('Mireille Ndongo');
    authorId = mireille.id;
    [akwa, elegance] = (await new SalonWorld(db).organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
      { name: 'Élégance Bonamoussadi', city: 'Douala', district: 'Bonamoussadi' },
    ])) as [WorldSalon, WorldSalon];
  });
  afterAll(() => t.close());
  beforeEach(() => {
    failure.armed = false;
  });

  const invite = async (
    salon: WorldSalon,
    phone: string,
    role: 'HAIRDRESSER' | 'SALON_ADMIN' = 'HAIRDRESSER',
  ) => {
    const invitation = Invitation.restore({
      ...anInvitation({ id: nextId(), salonId: salon.id, phone, role }).snapshot(),
      invitedByUserId: authorId,
    });
    await bus.inTransaction(() => invitations.add(invitation));
    return invitation.id;
  };
  const proveNumber = async (phone: string, token: string) => {
    const proof = PhoneProof.issue({
      id: nextId(),
      phone: PhoneNumber.parse(phone),
      purpose: 'INVITATION',
      tokenHash: hasher.hash(proofTokenSecret(token)),
      now: clock.now(),
    });
    await bus.inTransaction(() => proofs.add(proof));
  };
  const accept = (invitationId: string, token: string, details: typeof DETAILS | null = DETAILS) =>
    bus.execute(new AcceptInvitation({ invitationId, proofToken: token, details, session: null, sessionMaxAgeHours: 12 }));
  const membershipsInSalons = async () =>
    (await db.query(`SELECT count(*)::int AS n FROM salon_memberships`))[0].n as number;
  const countOf = async (table: string, where: string, value: string) =>
    (await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, [value]))[0].n as number;

  it('creates the account, the membership and the acceptance together, and erases what the salon typed', async () => {
    const phone = nextPhone();
    const id = await invite(akwa, phone);
    await proveNumber(phone, 'token-a');

    const done = await accept(id, 'token-a');

    expect(await countOf('users', 'phone = $1', phone)).toBe(1);
    expect(
      await db.query(`SELECT role, status FROM salon_memberships WHERE salon_id = $1 AND user_id = $2`, [
        akwa.id,
        done.userId,
      ]),
    ).toEqual([{ role: 'HAIRDRESSER', status: 'ACTIVE' }]);
    expect((await db.query(`SELECT * FROM salon_invitations WHERE id = $1`, [id]))[0]).toMatchObject({
      status: 'ACCEPTED',
      accepted_by_user_id: done.userId,
      name: null,
      phone: null,
    });
    const audit = await db.query(`SELECT action, details FROM audit_log WHERE actor_user_id = $1`, [
      done.userId,
    ]);
    expect(audit.map((row: { action: string }) => row.action).sort()).toEqual([
      'COLLABORATOR_ACCOUNT_CREATED',
      'INVITATION_ACCEPTED',
    ]);
    expect(JSON.stringify(audit)).not.toMatch(/Brice|Wouri|65500/);
  });

  it('leaves no account, no membership and the invitation pending when the recording fails after the account was created', async () => {
    const phone = nextPhone();
    const id = await invite(akwa, phone);
    await proveNumber(phone, 'token-b');
    const membershipsBefore = await membershipsInSalons();
    failure.armed = true;

    await expect(accept(id, 'token-b')).rejects.toThrow('database down');

    expect(await countOf('users', 'phone = $1', phone)).toBe(0);
    expect(await membershipsInSalons()).toBe(membershipsBefore);
    expect(await countOf('audit_log', 'subject_id = $1', id)).toBe(0);
    expect(
      (await db.query(`SELECT status, name, phone FROM salon_invitations WHERE id = $1`, [id]))[0],
    ).toMatchObject({
      status: 'PENDING',
      name: 'Brice Nana',
      phone,
    });
    failure.armed = false;
    await expect(accept(id, 'token-b')).resolves.toBeDefined();
  });

  describe('concurrency', () => {
    it('creates a single account and a single membership when the same invitation is accepted twice at once', async () => {
      const phone = nextPhone();
      const id = await invite(akwa, phone);
      await proveNumber(phone, 'token-c');
      const membershipsBefore = await membershipsInSalons();

      const results = await Promise.allSettled([accept(id, 'token-c'), accept(id, 'token-c')]);

      expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(
        InvitationNoLongerPendingError,
      );
      expect(await countOf('users', 'phone = $1', phone)).toBe(1);
      expect(await membershipsInSalons()).toBe(membershipsBefore + 1);
    });

    it('creates one account when two salons are accepted at once, the second asking to reload', async () => {
      const phone = nextPhone();
      const first = await invite(akwa, phone);
      const second = await invite(elegance, phone, 'SALON_ADMIN');
      await proveNumber(phone, 'token-d');

      const results = await Promise.allSettled([accept(first, 'token-d'), accept(second, 'token-d')]);

      expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({
        code: 'ACCOUNT_STATE_CHANGED',
      });
      expect(await countOf('users', 'phone = $1', phone)).toBe(1);
      const rejected = results[0]!.status === 'rejected' ? first : second;
      await expect(accept(rejected, 'token-d', null)).resolves.toBeDefined();
    });

    it('lets only one of an acceptance and a cancellation happening at once succeed', async () => {
      const phone = nextPhone();
      const id = await invite(akwa, phone);
      await proveNumber(phone, 'token-e');

      const results = await Promise.allSettled([
        accept(id, 'token-e'),
        bus.execute(new CancelInvitation(akwa.id, authorId, ['staff:invite'], id)),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const status = (await db.query(`SELECT status FROM salon_invitations WHERE id = $1`, [id]))[0].status;
      const members = await countOf('users', 'phone = $1', phone);
      expect(members).toBe(status === 'ACCEPTED' ? 1 : 0);
    });
  });

  describe('finding the invitation aimed at', () => {
    it('finds an invitation by the number it was sent to, never by another number', async () => {
      const phone = nextPhone();
      const id = await invite(akwa, phone);

      await expect(invitations.getOfInvitee(PhoneNumber.parse(phone), id)).resolves.toBeDefined();
      await expect(invitations.getOfInvitee(PhoneNumber.parse(nextPhone()), id)).rejects.toThrow(
        InvitationNotFoundError,
      );
    });

    it('still finds it for the account that accepted it once its number is erased, and for nobody else', async () => {
      const phone = nextPhone();
      const id = await invite(akwa, phone);
      await proveNumber(phone, 'token-f');
      await accept(id, 'token-f');

      await expect(invitations.getOfInvitee(PhoneNumber.parse(phone), id)).resolves.toBeDefined();
      await expect(invitations.getOfInvitee(PhoneNumber.parse(nextPhone()), id)).rejects.toThrow(
        InvitationNotFoundError,
      );
    });
  });
});
