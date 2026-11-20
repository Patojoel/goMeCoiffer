import { randomUUID } from 'node:crypto';
import { InvitationsForProvenPhoneSchema } from '@gomecoiffer/contracts';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLOCK } from '../../../../shared/application/ports.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SMS_SENDER } from '../../../identity/domain/ports/sms-sender.port.js';
import { InMemorySmsSender } from '../../../identity/tests/fakes/identity-fakes.js';
import { DAY_MS } from '../builders/invitation-builders.js';

/** Loin dans le futur : le cookie de preuve expire à l'horloge fixe, que la jarre de cookies compare à l'heure réelle. */
const NOW = new Date('2031-11-19T10:00:00+01:00');
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { type StaffAccount, StaffAccounts } from '../builders/staff-accounts.js';

const NOW_ON_THE_20TH = new Date(NOW.getTime() + DAY_MS);
const LIST_PATH = '/api/public/invitations';
const CODE_PATH = '/api/public/invitations/code';
const PROOF_PATH = '/api/public/invitations/phone-proof';
const NO_PROOF = 'Votre vérification a expiré : demandez un nouveau code pour continuer.';

const codeIn = (text: string | undefined) => text?.match(/\b(\d{6})\b/)?.[1] ?? '';
const eventually = async (condition: () => boolean) => {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise((r) => setTimeout(r, 20));
};

describe('A person who proved a number sees the invitations waiting for it', () => {
  let t: TestApp;
  let db: DataSource;
  let clock: FixedClock;
  let sms: InMemorySmsSender;
  let accounts: StaffAccounts;
  let mireille: StaffAccount;
  let akwa: WorldSalon;
  let elegance: WorldSalon;
  let nextNumber = 656_000_000;

  beforeAll(async () => {
    clock = new FixedClock(NOW_ON_THE_20TH);
    sms = new InMemorySmsSender();
    t = await startTestApp({
      overrides: [
        [CLOCK, clock],
        [SMS_SENDER, sms],
      ],
    });
    db = t.moduleRef.get(getDataSourceToken());
    accounts = new StaffAccounts(db);
    const world = new SalonWorld(db);
    mireille = await accounts.create('Mireille Ndongo');
    const clarisse = await accounts.create('Clarisse Fotso');
    [akwa] = (await world.organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
    ])) as [WorldSalon];
    [elegance] = (await world.organizationOf(clarisse.id, [
      { name: 'Élégance Bonamoussadi', city: 'Douala', district: 'Bonamoussadi' },
    ])) as [WorldSalon];
  });
  afterAll(() => t.close());

  const aNewcomer = () => {
    const national = String(nextNumber++);
    const typed = `${national[0]} ${national.slice(1, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
    return { e164: `+237${national}`, typed };
  };
  const invite = async (
    salon: WorldSalon,
    e164: string,
    over: { role?: string; sentAt?: Date; expiresAt?: Date; status?: string; name?: string } = {},
  ): Promise<string> => {
    const id = randomUUID();
    const status = over.status ?? 'PENDING';
    await db.query(
      `INSERT INTO salon_invitations (id, salon_id, name, phone, role, invited_by_user_id, sent_at, expires_at, status, notified_by_sms, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 1)`,
      [
        id,
        salon.id,
        over.name ?? 'Brice Nana',
        e164,
        over.role ?? 'HAIRDRESSER',
        mireille.id,
        over.sentAt ?? NOW,
        over.expiresAt ?? new Date(NOW.getTime() + 7 * DAY_MS),
        status,
      ],
    );
    return id;
  };
  const prove = async (browser: Browser, person: { typed: string; e164: string }) => {
    const before = sms.sent.length;
    await browser.post(CODE_PATH, { phone: person.typed });
    await eventually(() => sms.sent.length > before);
    return browser.post(PROOF_PATH, { phone: person.typed, code: codeIn(sms.lastTo(person.e164)) });
  };

  it('refuses a browser that never proved a number, in the words of the acceptance', async () => {
    const brice = aNewcomer();
    await invite(akwa, brice.e164);

    const res = await t.browser().get(LIST_PATH);

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'PHONE_PROOF_REQUIRED', message: NO_PROOF });
  });

  it('lists only the pending invitations of the proven number, newest first, without who invited', async () => {
    const brice = aNewcomer();
    const other = aNewcomer();
    const older = await invite(akwa, brice.e164, {
      role: 'HAIRDRESSER',
      sentAt: new Date(NOW.getTime() - DAY_MS),
      expiresAt: new Date(NOW_ON_THE_20TH.getTime() + 5 * DAY_MS),
    });
    const newer = await invite(elegance, brice.e164, {
      role: 'SALON_ADMIN',
      sentAt: NOW,
      expiresAt: new Date(NOW_ON_THE_20TH.getTime() + 6 * DAY_MS),
      name: 'Brice N.',
    });
    await invite(akwa, other.e164);
    await invite(elegance, other.e164);
    const browser = t.browser();
    await prove(browser, brice);
    const res = await browser.get(LIST_PATH);

    expect(res.status).toBe(200);
    const list = InvitationsForProvenPhoneSchema.parse(res.body.data);
    expect(list.account).toBe('NEW');
    expect(list.invitations).toEqual([
      {
        invitationId: newer,
        salonName: 'Élégance Bonamoussadi',
        city: 'Douala',
        district: 'Bonamoussadi',
        role: 'SALON_ADMIN',
        expiresAt: new Date(NOW_ON_THE_20TH.getTime() + 6 * DAY_MS).toISOString(),
        suggestedName: 'Brice N.',
      },
      {
        invitationId: older,
        salonName: 'Go Beauty Akwa',
        city: 'Douala',
        district: 'Akwa',
        role: 'HAIRDRESSER',
        expiresAt: new Date(NOW_ON_THE_20TH.getTime() + 5 * DAY_MS).toISOString(),
        suggestedName: 'Brice Nana',
      },
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/Mireille|Ndongo|Clarisse|Fotso|invitedBy|\+237/);
  });

  it('leaves out invitations that expired or were cancelled since the code was typed, with an empty list', async () => {
    const brice = aNewcomer();
    await invite(akwa, brice.e164, { expiresAt: new Date(NOW_ON_THE_20TH.getTime() + 60_000) });
    const cancelled = await invite(elegance, brice.e164);
    const browser = t.browser();
    await prove(browser, brice);
    await db.query(`UPDATE salon_invitations SET status = 'CANCELLED', ended_at = now() WHERE id = $1`, [
      cancelled,
    ]);
    clock.set(new Date(NOW_ON_THE_20TH.getTime() + 60_000));

    const res = await browser.get(LIST_PATH);
    clock.set(NOW_ON_THE_20TH);

    expect(res.status).toBe(200);
    expect(res.body.data.invitations).toEqual([]);
  });

  it('expires with the proof, to the second', async () => {
    const brice = aNewcomer();
    await invite(akwa, brice.e164);
    const browser = t.browser();
    await prove(browser, brice);

    clock.set(new Date(NOW_ON_THE_20TH.getTime() + 15 * 60_000 - 1000));
    const inTime = await browser.get(LIST_PATH);
    clock.set(new Date(NOW_ON_THE_20TH.getTime() + 15 * 60_000));
    const late = await browser.get(LIST_PATH);
    clock.set(NOW_ON_THE_20TH);

    expect(inTime.status).toBe(200);
    expect(inTime.body.data.invitations).toHaveLength(1);
    expect(late.body).toMatchObject({ code: 'PHONE_PROOF_REQUIRED', message: NO_PROOF });
  });

  it.each([
    ['a staff account', 'EXISTING', true],
    ['a light client account without password', 'TO_COMPLETE', false],
  ])(
    'tells the screen what to ask a person who already has %s: %s',
    async (_label, expected, withPassword) => {
      const person = await accounts.create('Paul Ebode', { password: withPassword });
      await invite(akwa, person.e164);
      const browser = t.browser();
      await prove(browser, person);

      const res = await browser.get(LIST_PATH);

      expect(res.status).toBe(200);
      expect(res.body.data.account).toBe(expected);
      expect(res.body.data.invitations).toHaveLength(1);
    },
  );
});
