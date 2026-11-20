import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';
import { DEMO_PASSWORD, identitySeeder } from '../../seed/identity.seed.js';
import { organizationsSeeder } from '../../seed/organizations.seed.js';

describe('Seeding the demo data', () => {
  let t: TestApp;
  let db: DataSource;

  const seed = async () => {
    await identitySeeder.run(db);
    await organizationsSeeder.run(db);
  };
  const countOf = async (table: string) =>
    Number((await db.query(`SELECT count(*) AS n FROM ${table}`))[0].n);

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
    await seed();
  });
  afterAll(() => t.close());

  const signIn = (phone: string) =>
    t.browser().post('/api/public/auth/sign-in', { phone, password: DEMO_PASSWORD });

  it('can be replayed without duplicating anything', async () => {
    await seed();

    expect(await countOf('users')).toBe(8);
    expect(await countOf('organizations')).toBe(2);
    expect(await countOf('salons')).toBe(3);
    expect(await countOf('salon_memberships')).toBe(9);
    expect(await countOf('salon_role_permissions')).toBe(12);
    expect(await countOf('salon_invitations')).toBe(3);
  });

  it('gives Akwa two pending invitations (one to a number with no account, to try joining a salon) and one expired, so the invitations screen is not empty', async () => {
    const rows = await db.query(
      `SELECT name, status, expires_at > now() AS "stillValid" FROM salon_invitations ORDER BY sent_at DESC`,
    );

    expect(rows).toEqual([
      { name: 'Brice Nana', status: 'PENDING', stillValid: true },
      { name: 'Brice Nana', status: 'PENDING', stillValid: true },
      { name: 'Grâce Mbarga', status: 'EXPIRED', stillValid: false },
    ]);
  });

  it('lets Mireille sign in and choose between her two salons, Akwa and Bastos', async () => {
    const res = await signIn('6 77 12 34 56');

    expect(res.status).toBe(200);
    expect(res.body.data.session.nextStep).toBe('CHOOSE_SALON');
    expect(res.body.data.session.salons).toEqual([
      expect.objectContaining({ name: 'Go Beauty Akwa', role: 'OWNER', city: 'Douala', district: 'Akwa' }),
      expect.objectContaining({
        name: 'Go Beauty Bastos',
        role: 'OWNER',
        city: 'Yaoundé',
        district: 'Bastos',
      }),
    ]);
  });

  it('lets Clarisse sign in as the owner of her only salon', async () => {
    const res = await signIn('6 55 44 33 22');

    expect(res.body.data.session.nextStep).toBe('OPEN_SALON');
    expect(res.body.data.session.salons).toEqual([
      expect.objectContaining({ name: 'Élégance Bonamoussadi', role: 'OWNER', district: 'Bonamoussadi' }),
    ]);
  });

  it('makes Paul a hairdresser of Élégance without any organisation of his own, to go through the creation locally', async () => {
    const res = await signIn('6 99 00 11 22');

    expect(res.body.data.session.nextStep).toBe('OPEN_SALON');
    expect(res.body.data.session.salons).toEqual([
      expect.objectContaining({ name: 'Élégance Bonamoussadi', role: 'HAIRDRESSER' }),
    ]);
    expect(
      Number(
        (
          await db.query(
            `SELECT count(*) AS n FROM organizations o JOIN users u ON u.id = o.owner_user_id WHERE u.name = 'Paul Ebode'`,
          )
        )[0].n,
      ),
    ).toBe(0);
  });

  it('makes Awa a hairdresser of Go Beauty Akwa only', async () => {
    const res = await signIn('6 70 11 22 33');

    expect(res.body.data.session.nextStep).toBe('OPEN_SALON');
    expect(res.body.data.session.salons).toEqual([
      expect.objectContaining({ name: 'Go Beauty Akwa', role: 'HAIRDRESSER' }),
    ]);
  });
});
