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

  it('can be replayed without duplicating anything', async () => {
    await seed();

    expect(await countOf('users')).toBe(2);
    expect(await countOf('organizations')).toBe(1);
    expect(await countOf('salons')).toBe(1);
    expect(await countOf('salon_memberships')).toBe(1);
  });

  it('lets Mireille sign in and leads her to her unpublished salon', async () => {
    const browser = t.browser();

    const res = await browser.post('/api/public/auth/sign-in', {
      phone: '6 77 12 34 56',
      password: DEMO_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.session.nextStep).toBe('OPEN_SALON');
    expect(res.body.data.session.salons).toMatchObject([{ name: 'Go Beauty Akwa', role: 'OWNER' }]);
  });

  it('leaves Paul without organization, to go through the creation locally', async () => {
    const browser = t.browser();

    const res = await browser.post('/api/public/auth/sign-in', {
      phone: '6 99 00 11 22',
      password: DEMO_PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.session.nextStep).toBe('CREATE_ORGANIZATION');
  });
});
