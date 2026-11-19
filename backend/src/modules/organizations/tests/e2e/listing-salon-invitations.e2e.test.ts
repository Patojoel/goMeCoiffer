import { SalonInvitationsSchema } from '@gomecoiffer/contracts';
import { getDataSourceToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CLOCK } from '../../../../shared/application/ports.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { DAY_MS, NOW } from '../builders/invitation-builders.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { type StaffAccount, StaffAccounts } from '../builders/staff-accounts.js';

const INVITATIONS = '/api/salon/invitations';
const SELECT = '/api/salon/session/active-salon';
const NO_RIGHT = 'Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire.';

interface Seed {
  readonly salonId: string;
  readonly name: string | null;
  readonly phone: string | null;
  readonly status: string;
  readonly sentDaysAgo: number;
  readonly expiresInDays: number;
  readonly role?: string;
}

const names = (res: { body: { data: Array<{ name: string }> } }) => res.body.data.map((i) => i.name);

describe('A salon owner consults the invitations of the open salon', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let accounts: StaffAccounts;
  let world: SalonWorld;
  let mireille: StaffAccount;
  let awa: StaffAccount;
  let clarisse: StaffAccount;
  let akwa: WorldSalon;
  let bastos: WorldSalon;
  let elegance: WorldSalon;

  beforeAll(async () => {
    clock = new FixedClock(NOW);
    t = await startTestApp({ overrides: [[CLOCK, clock]] });
    db = t.moduleRef.get(getDataSourceToken());
    accounts = new StaffAccounts(db);
    world = new SalonWorld(db);
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    clock.set(NOW);
    await db.query(`DELETE FROM salon_invitations`);
    mireille = await accounts.create('Mireille Ndongo');
    awa = await accounts.create('Awa Tchoua');
    clarisse = await accounts.create('Clarisse Fotso');
    [akwa, bastos] = (await world.organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
      { name: 'Go Beauty Bastos', city: 'Yaoundé', district: 'Bastos' },
    ])) as [WorldSalon, WorldSalon];
    [elegance] = (await world.organizationOf(clarisse.id, [
      { name: 'Élégance Bonamoussadi', city: 'Douala', district: 'Bonamoussadi' },
    ])) as [WorldSalon];
    await world.membership(akwa.id, awa.id, 'HAIRDRESSER');
  });

  const seed = (s: Seed) =>
    db.query(
      `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, ended_at, notified_by_sms, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, true, 1)`,
      [
        randomUUID(),
        s.salonId,
        s.name,
        s.phone,
        s.role ?? 'HAIRDRESSER',
        mireille.id,
        new Date(NOW.getTime() - s.sentDaysAgo * DAY_MS),
        new Date(NOW.getTime() + s.expiresInDays * DAY_MS),
        s.status,
      ],
    );
  const list = async (person: StaffAccount, salon?: WorldSalon) => {
    const browser = t.browser();
    await accounts.signIn(browser, person);
    if (salon) browser.useCsrfToken((await browser.post(SELECT, { salonId: salon.id })).body.data.csrfToken);
    return browser.get(INVITATIONS);
  };
  const brice = (): Seed => ({
    salonId: akwa.id,
    name: 'Brice Nana',
    phone: '+237655443322',
    status: 'PENDING',
    sentDaysAgo: 1,
    expiresInDays: 6,
  });

  it('lists pending and expired invitations of the open salon, most recent first, in the contract shape', async () => {
    await seed({
      ...brice(),
      name: 'Grâce Mbarga',
      phone: '+237677000002',
      sentDaysAgo: 9,
      expiresInDays: -2,
    });
    await seed({ ...brice(), role: 'SALON_ADMIN' });

    const res = await list(mireille, akwa);

    expect(res.status).toBe(200);
    const invitations = SalonInvitationsSchema.parse(res.body.data);
    expect(invitations.map((i) => [i.name, i.phone, i.role, i.status])).toEqual([
      ['Brice Nana', '+237655443322', 'SALON_ADMIN', 'PENDING'],
      ['Grâce Mbarga', '+237677000002', 'HAIRDRESSER', 'EXPIRED'],
    ]);
    expect(invitations[0]).toMatchObject({
      sentAt: '2026-11-18T09:00:00.000Z',
      expiresAt: '2026-11-25T09:00:00.000Z',
    });
  });

  it('reads as expired a pending invitation whose deadline has passed, even before the cleaning task marked it', async () => {
    await seed({
      ...brice(),
      name: 'Grâce Mbarga',
      phone: '+237677000002',
      sentDaysAgo: 7.5,
      expiresInDays: -0.5,
    });
    await seed({
      ...brice(),
      name: 'Ruth Eyenga',
      phone: '+237677000003',
      status: 'EXPIRED',
      sentDaysAgo: 12,
      expiresInDays: -5,
    });

    const res = await list(mireille, akwa);

    expect(res.body.data.map((i: { name: string; status: string }) => [i.name, i.status])).toEqual([
      ['Grâce Mbarga', 'EXPIRED'],
      ['Ruth Eyenga', 'EXPIRED'],
    ]);
  });

  it('does not list cancelled or accepted invitations', async () => {
    await seed(brice());
    await seed({
      ...brice(),
      name: 'Ruth Eyenga',
      phone: '+237677000003',
      status: 'CANCELLED',
      sentDaysAgo: 2,
    });
    await seed({
      ...brice(),
      name: 'Paul Ebode',
      phone: '+237677000004',
      status: 'ACCEPTED',
      sentDaysAgo: 3,
    });

    const res = await list(mireille, akwa);

    expect(names(res)).toEqual(['Brice Nana']);
  });

  it('does not list an expired invitation whose name and number were erased', async () => {
    await seed({
      ...brice(),
      name: null,
      phone: null,
      status: 'EXPIRED',
      sentDaysAgo: 40,
      expiresInDays: -33,
    });
    await seed({
      ...brice(),
      name: 'Grâce Mbarga',
      phone: '+237677000002',
      status: 'EXPIRED',
      sentDaysAgo: 10,
      expiresInDays: -3,
    });

    const res = await list(mireille, akwa);

    expect(names(res)).toEqual(['Grâce Mbarga']);
  });

  it('never shows the invitations of another salon, even to the owner of both', async () => {
    await seed(brice());
    await seed({
      ...brice(),
      salonId: elegance.id,
      name: 'Intrus Autre',
      phone: '+237677000009',
      sentDaysAgo: 0,
    });

    const fromBastos = await list(mireille, bastos);
    const fromAkwa = await list(mireille, akwa);

    expect(fromBastos.status).toBe(200);
    expect(fromBastos.body.data).toEqual([]);
    expect(names(fromAkwa)).toEqual(['Brice Nana']);
  });

  it('keeps the most recent invitations when there are more than 100 to show', async () => {
    await seed(brice());
    await db.query(
      `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, notified_by_sms, version)
       SELECT gen_random_uuid(), $1::uuid, 'Ancien ' || g, '+2376000' || lpad(g::text, 5, '0'), 'HAIRDRESSER', $2::uuid,
              $3::timestamptz - (g || ' hours')::interval - interval '8 days',
              $3::timestamptz - (g || ' hours')::interval - interval '1 day',
              'EXPIRED', false, 1
       FROM generate_series(1, 150) g`,
      [akwa.id, mireille.id, NOW],
    );

    const res = await list(mireille, akwa);

    expect(res.body.data).toHaveLength(100);
    expect(names(res).slice(0, 2)).toEqual(['Brice Nana', 'Ancien 1']);
  });

  it('refuses a hairdresser, who cannot invite and so cannot consult', async () => {
    const res = await list(awa, akwa);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(NO_RIGHT);
  });

  it('refuses a person who is not signed in', async () => {
    const res = await t.browser().get(INVITATIONS);

    expect(res.status).toBe(401);
  });

  it('marks the response with Cache-Control: no-store', async () => {
    const res = await list(mireille, akwa);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
