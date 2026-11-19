import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { ConcurrencyConflictError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { PurgeEndedInvitations } from '../../application/commands/purge-ended-invitations/purge-ended-invitations.command.js';
import { Invitation } from '../../domain/aggregates/invitation.js';
import { InvitationAlreadyPendingError } from '../../domain/exceptions/invitation-already-pending.error.js';
import { InvitationNotFoundError } from '../../domain/exceptions/invitation-not-found.error.js';
import {
  INVITATION_CHECKS,
  type InvitationChecks,
} from '../../domain/repositories/read/invitation-checks.read-repository.js';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../domain/repositories/write/invitation.repository.js';
import { CLOCK } from '../../../../shared/application/ports.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { anInvitation, DAY_MS, NOW } from '../builders/invitation-builders.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { StaffAccounts } from '../builders/staff-accounts.js';

const HOUR_MS = 3_600_000;
let counter = 0;
const nextId = () => `0195f000-0000-7000-8000-0000000a${String(++counter).padStart(4, '0')}`;

describe('Storing invitations in PostgreSQL', () => {
  let t: TestApp;
  let db: DataSource;
  let bus: TransactionalCommandBus;
  let invitations: InvitationRepository;
  let checks: InvitationChecks;
  let clock: FixedClock;
  let akwa: WorldSalon;
  let bastos: WorldSalon;
  let accounts: StaffAccounts;
  let authorId: string;

  beforeAll(async () => {
    clock = new FixedClock(NOW);
    t = await startTestApp({ overrides: [[CLOCK, clock]] });
    db = t.moduleRef.get(getDataSourceToken());
    bus = t.moduleRef.get(TransactionalCommandBus);
    invitations = t.moduleRef.get(INVITATION_REPOSITORY);
    checks = t.moduleRef.get(INVITATION_CHECKS);
    accounts = new StaffAccounts(db);
    const mireille = await accounts.create('Mireille Ndongo');
    authorId = mireille.id;
    [akwa, bastos] = (await new SalonWorld(db).organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
      { name: 'Go Beauty Bastos', city: 'Yaoundé', district: 'Bastos' },
    ])) as [WorldSalon, WorldSalon];
  });
  afterAll(() => t.close());

  const invitation = (over: Parameters<typeof anInvitation>[0] = {}) =>
    Invitation.restore({ ...anInvitation({ id: nextId(), ...over }).snapshot(), invitedByUserId: authorId });
  const store = (inv: Invitation) => bus.inTransaction(() => invitations.add(inv));
  const phoneN = (n: number) => `+2376600${String(n).padStart(5, '0')}`;
  const rowOf = async (id: string) =>
    (await db.query(`SELECT * FROM salon_invitations WHERE id = $1`, [id]))[0];

  describe('one pending invitation per number and salon', () => {
    it('refuses a second pending invitation for the same number in the same salon', async () => {
      const phone = phoneN(1);
      await store(invitation({ salonId: akwa.id, phone }));

      await expect(store(invitation({ salonId: akwa.id, phone }))).rejects.toThrow(
        InvitationAlreadyPendingError,
      );
    });

    it('keeps a single row when two requests invite the same number at the same time', async () => {
      const phone = phoneN(2);

      const results = await Promise.allSettled([
        store(invitation({ salonId: akwa.id, phone })),
        store(invitation({ salonId: akwa.id, phone })),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(
        InvitationAlreadyPendingError,
      );
      expect(await db.query(`SELECT 1 FROM salon_invitations WHERE phone = $1`, [phone])).toHaveLength(1);
    });

    it('accepts the same number in another salon, and again once the first invitation is no longer pending', async () => {
      const phone = phoneN(3);
      const first = invitation({ salonId: akwa.id, phone });
      await store(first);
      await store(invitation({ salonId: bastos.id, phone }));

      await bus.inTransaction(async () => {
        const loaded = await invitations.getOfSalon(akwa.id, first.id);
        loaded.cancel(authorId, NOW);
        await invitations.save(loaded);
      });

      await expect(store(invitation({ salonId: akwa.id, phone }))).resolves.toBeUndefined();
    });
  });

  describe('loading and cancelling', () => {
    it('loads an invitation only inside its own salon', async () => {
      const inv = invitation({ salonId: akwa.id, phone: phoneN(4) });
      await store(inv);

      await expect(bus.inTransaction(() => invitations.getOfSalon(bastos.id, inv.id))).rejects.toThrow(
        InvitationNotFoundError,
      );
      await expect(bus.inTransaction(() => invitations.getOfSalon(akwa.id, inv.id))).resolves.toBeDefined();
    });

    it('refuses a change made on a stale copy of the invitation', async () => {
      const inv = invitation({ salonId: akwa.id, phone: phoneN(5) });
      await store(inv);
      const load = () => bus.inTransaction(() => invitations.getOfSalon(akwa.id, inv.id));
      const first = await load();
      const second = await load();
      first.cancel(authorId, NOW);
      await bus.inTransaction(() => invitations.save(first));

      second.cancel(authorId, NOW);

      await expect(bus.inTransaction(() => invitations.save(second))).rejects.toThrow(
        ConcurrencyConflictError,
      );
      expect((await rowOf(inv.id)).status).toBe('CANCELLED');
    });

    it('finds the pending invitation of a number in a salon, and nothing in another salon', async () => {
      const phone = phoneN(6);
      await store(invitation({ salonId: akwa.id, phone }));

      expect(await invitations.findPendingOfPhone(akwa.id, PhoneNumber.parse(phone))).not.toBeNull();
      expect(await invitations.findPendingOfPhone(bastos.id, PhoneNumber.parse(phone))).toBeNull();
    });
  });

  describe('the reads a command needs', () => {
    it('knows an active member of the salon by its phone number, and no other person', async () => {
      const [member] = await db.query(
        `SELECT u.phone FROM users u JOIN salon_memberships m ON m.user_id = u.id WHERE m.salon_id = $1`,
        [akwa.id],
      );
      const asNumber = PhoneNumber.parse(member.phone);

      expect(await checks.isActiveMember(akwa.id, asNumber)).toBe(true);
      expect(await checks.isActiveMember(bastos.id, PhoneNumber.parse('6 55 00 00 01'))).toBe(false);
    });

    it('counts the invitations sent by one salon in the last 24 hours, boundary included', async () => {
      const salon = (
        await new SalonWorld(db).organizationOf((await accounts.create('Clarisse Fotso')).id, [
          { name: 'Élégance Bonamoussadi', city: 'Douala', district: 'Bonamoussadi' },
        ])
      )[0]!;
      await store(
        invitation({ salonId: salon.id, phone: phoneN(10), now: new Date(NOW.getTime() - 24 * HOUR_MS) }),
      );
      await store(
        invitation({ salonId: salon.id, phone: phoneN(11), now: new Date(NOW.getTime() - 25 * HOUR_MS) }),
      );
      await store(invitation({ salonId: salon.id, phone: phoneN(12), now: NOW }));

      expect(await checks.invitationsSentSince(salon.id, new Date(NOW.getTime() - 24 * HOUR_MS))).toBe(2);
    });

    it('counts the pending invitations that are not expired yet', async () => {
      const salon = (
        await new SalonWorld(db).organizationOf((await accounts.create('Paul Ebode')).id, [
          { name: 'Paul Barber Deïdo', city: 'Douala', district: 'Deïdo' },
        ])
      )[0]!;
      await store(invitation({ salonId: salon.id, phone: phoneN(20), now: NOW }));
      await store(
        invitation({ salonId: salon.id, phone: phoneN(21), now: new Date(NOW.getTime() - 8 * DAY_MS) }),
      );

      expect(await checks.pendingCount(salon.id, NOW)).toBe(1);
    });

    it('counts the SMS decided for a number in the last 24 hours, all salons together', async () => {
      const phone = phoneN(30);
      await store(invitation({ salonId: akwa.id, phone, notifyBySms: true }));
      await store(invitation({ salonId: bastos.id, phone, notifyBySms: true }));
      await store(invitation({ salonId: bastos.id, phone: phoneN(31), notifyBySms: true }));
      const other = invitation({ salonId: akwa.id, phone: phoneN(32), notifyBySms: false });
      await store(other);

      expect(
        await checks.textMessagesSentSince(PhoneNumber.parse(phone), new Date(NOW.getTime() - 24 * HOUR_MS)),
      ).toBe(2);
      expect(
        await checks.textMessagesSentSince(
          PhoneNumber.parse(phoneN(32)),
          new Date(NOW.getTime() - 24 * HOUR_MS),
        ),
      ).toBe(0);
    });

    it('reads the time zone of a salon', async () => {
      expect(await checks.salonOf(akwa.id)).toEqual({ timezone: 'Africa/Douala' });
    });
  });

  describe('forgetting the name and number of invitations that ended', () => {
    const insertEnded = async (
      status: 'EXPIRED' | 'CANCELLED' | 'ACCEPTED' | 'PENDING',
      endedAt: Date,
      phone: string,
    ) => {
      const id = nextId();
      const sentAt = new Date(endedAt.getTime() - 7 * DAY_MS);
      await db.query(
        `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, ended_at, notified_by_sms, version)
         VALUES ($1, $2, 'Brice Nana', $3, 'HAIRDRESSER', $4, $5, $6, $7, $8, false, 1)`,
        [
          id,
          akwa.id,
          phone,
          authorId,
          sentAt,
          status === 'CANCELLED' ? new Date(endedAt.getTime() + 3 * DAY_MS) : endedAt,
          status,
          status === 'PENDING' ? null : endedAt,
        ],
      );
      return id;
    };
    const purge = () => bus.execute(new PurgeEndedInvitations());

    it('erases name and number 30 days after an invitation expired or was cancelled, and keeps the rest', async () => {
      clock.set(NOW);
      const expired = await insertEnded('EXPIRED', new Date(NOW.getTime() - 30 * DAY_MS), phoneN(40));
      const cancelled = await insertEnded('CANCELLED', new Date(NOW.getTime() - 31 * DAY_MS), phoneN(41));

      await purge();

      expect(await rowOf(expired)).toMatchObject({
        name: null,
        phone: null,
        status: 'EXPIRED',
        role: 'HAIRDRESSER',
      });
      expect(await rowOf(cancelled)).toMatchObject({ name: null, phone: null, status: 'CANCELLED' });
    });

    it('keeps an invitation that ended one second less than 30 days ago', async () => {
      clock.set(NOW);
      const id = await insertEnded('EXPIRED', new Date(NOW.getTime() - 30 * DAY_MS + 1000), phoneN(42));

      await purge();

      expect(await rowOf(id)).toMatchObject({ name: 'Brice Nana', phone: phoneN(42) });
    });

    it('never touches a pending or an accepted invitation, and can be replayed', async () => {
      clock.set(NOW);
      const accepted = await insertEnded('ACCEPTED', new Date(NOW.getTime() - 60 * DAY_MS), phoneN(43));
      const pending = await insertEnded('PENDING', new Date(NOW.getTime() + 2 * DAY_MS), phoneN(44));

      await purge();
      await expect(purge()).resolves.toEqual({ purged: 0 });

      expect(await rowOf(accepted)).toMatchObject({ name: 'Brice Nana', status: 'ACCEPTED' });
      expect(await rowOf(pending)).toMatchObject({ name: 'Brice Nana', status: 'PENDING' });
    });

    it('turns a pending invitation overdue for 30 days into an expired one', async () => {
      clock.set(NOW);
      const id = await insertEnded('PENDING', new Date(NOW.getTime() - 31 * DAY_MS), phoneN(45));

      await purge();

      expect(await rowOf(id)).toMatchObject({ name: null, phone: null, status: 'EXPIRED' });
    });
  });

  describe('counters for the SMS limit', () => {
    it('counts distinct salons per phone over 24 hours, even when one salon invited and cancelled several times', async () => {
      const phone = phoneN(50);
      for (const status of ['CANCELLED', 'CANCELLED', 'PENDING'] as const) {
        await db.query(
          `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, ended_at, notified_by_sms, version)
           VALUES ($1, $2, 'Brice Nana', $3, 'HAIRDRESSER', $4, $5, $6, $7, $8, true, 1)`,
          [
            nextId(),
            akwa.id,
            phone,
            authorId,
            new Date(NOW.getTime() - HOUR_MS),
            new Date(NOW.getTime() + 6 * DAY_MS),
            status,
            status === 'CANCELLED' ? NOW : null,
          ],
        );
      }
      await db.query(
        `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, notified_by_sms, version)
         VALUES ($1, $2, 'Brice Nana', $3, 'HAIRDRESSER', $4, $5, $6, 'PENDING', true, 1)`,
        [nextId(), bastos.id, phone, authorId, new Date(NOW.getTime() - HOUR_MS), new Date(NOW.getTime() + 6 * DAY_MS)],
      );

      const count = await bus.inTransaction(() =>
        checks.textMessagesSentSince(PhoneNumber.parse(phone), new Date(NOW.getTime() - 24 * HOUR_MS)),
      );

      expect(count).toBe(2);
    });
  });
});
