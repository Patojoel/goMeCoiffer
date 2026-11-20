import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { defaultPermissionsOf } from '../../domain/value-objects/role-permission-set.js';
import { SalonWorld, type WorldSalon } from '../builders/salon-world.js';
import { type StaffAccount, StaffAccounts } from '../builders/staff-accounts.js';

const INVITE = '/api/salon/invitations';
const SELECT = '/api/salon/session/active-salon';

/** T24 / UC-006 T28 : règle « pas plus de droits que soi » lue depuis salon_role_permissions (RG-008-12, D-042). */
describe('A salon administrator invites only to a role that has no more rights than his own (T24)', () => {
  let t: TestApp;
  let db: DataSource;
  let accounts: StaffAccounts;
  let world: SalonWorld;
  let mireille: StaffAccount;
  let rodrigue: StaffAccount;
  let akwa: WorldSalon;

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
    accounts = new StaffAccounts(db);
    world = new SalonWorld(db);
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    mireille = await accounts.create('Mireille Ndongo');
    rodrigue = await accounts.create('Rodrigue Etoa');
    [akwa] = (await world.organizationOf(mireille.id, [
      { name: 'Go Beauty Akwa', city: 'Douala', district: 'Akwa' },
    ])) as [WorldSalon];
    await world.membership(akwa.id, rodrigue.id, 'SALON_ADMIN');
  });

  const openAkwa = async (person: StaffAccount) => {
    const browser = t.browser();
    await accounts.signIn(browser, person);
    const res = await browser.post(SELECT, { salonId: akwa.id });
    const csrfToken = res.body.data.csrfToken as string;
    browser.useCsrfToken(csrfToken);
    return { browser, csrfToken };
  };

  const adjust = (
    browser: Browser,
    csrfToken: string,
    role: string,
    permissions: readonly string[],
    version: number,
  ) =>
    browser.agent
      .put(`/api/salon/roles/${role}/permissions`)
      .set('x-csrf-token', csrfToken)
      .send({ permissions, version });

  it('lets a default salon administrator invite a hairdresser', async () => {
    const { browser } = await openAkwa(rodrigue);

    const res = await browser.post(INVITE, {
      name: 'Esther Ngo Bilong',
      phone: '6 77 88 99 00',
      role: 'HAIRDRESSER',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('HAIRDRESSER');
  });

  it('refuses a finance manager role to a default salon administrator with ROLE_ABOVE_INVITER', async () => {
    const { browser } = await openAkwa(rodrigue);

    const res = await browser.post(INVITE, {
      name: 'Esther Ngo Bilong',
      phone: '6 77 88 99 01',
      role: 'FINANCE_MANAGER',
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ROLE_ABOVE_INVITER');
    expect(res.body.message).toBe(
      "Ce rôle donne des droits que vous n'avez pas dans ce salon : demandez au propriétaire d'envoyer l'invitation.",
    );
  });

  it('lets the salon administrator invite a finance manager once the owner grants the three finance permissions', async () => {
    const owner = await openAkwa(mireille);
    const admin = await openAkwa(rodrigue);

    const adjusted = await adjust(
      owner.browser,
      owner.csrfToken,
      'SALON_ADMIN',
      [...defaultPermissionsOf('SALON_ADMIN'), 'finances:view', 'finances:record-payment', 'finances:export'],
      1,
    );
    expect(adjusted.status).toBe(200);

    const res = await admin.browser.post(INVITE, {
      name: 'Esther Ngo Bilong',
      phone: '6 77 88 99 02',
      role: 'FINANCE_MANAGER',
    });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('FINANCE_MANAGER');
  });

  it('refuses hairdresser to a default salon administrator when hairdresser receives finances:view', async () => {
    const owner = await openAkwa(mireille);
    const admin = await openAkwa(rodrigue);

    const adjusted = await adjust(
      owner.browser,
      owner.csrfToken,
      'HAIRDRESSER',
      [...defaultPermissionsOf('HAIRDRESSER'), 'finances:view'],
      1,
    );
    expect(adjusted.status).toBe(200);

    const res = await admin.browser.post(INVITE, {
      name: 'Esther Ngo Bilong',
      phone: '6 77 88 99 03',
      role: 'HAIRDRESSER',
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ROLE_ABOVE_INVITER');
  });

  it('refuses any new invitation immediately after staff:invite is removed, without disconnecting the administrator', async () => {
    const owner = await openAkwa(mireille);
    const admin = await openAkwa(rodrigue);

    const adjusted = await adjust(
      owner.browser,
      owner.csrfToken,
      'SALON_ADMIN',
      defaultPermissionsOf('SALON_ADMIN').filter((p) => p !== 'staff:invite'),
      1,
    );
    expect(adjusted.status).toBe(200);

    const refused = await admin.browser.post(INVITE, {
      name: 'Esther Ngo Bilong',
      phone: '6 77 88 99 04',
      role: 'HAIRDRESSER',
    });
    expect(refused.status).toBe(403);
    expect(refused.body.message).toBe(
      'Votre rôle dans ce salon ne permet pas cette action : demandez-la au propriétaire.',
    );

    const session = await admin.browser.get('/api/salon/session');
    expect(session.status).toBe(200);
    expect(session.body.data.activeSalonId).toBe(akwa.id);
    expect(session.body.data.permissions).not.toContain('staff:invite');
  });
});
