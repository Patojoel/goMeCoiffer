import { SessionSummarySchema } from '@gomecoiffer/contracts';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Browser, startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { SMS_SENDER } from '../../domain/ports/sms-sender.port.js';
import { InMemorySmsSender } from '../fakes/identity-fakes.js';

const PASSWORD = 'Akwa-Tresses-27';
const codeIn = (sms: string | undefined) => sms?.match(/\b(\d{6})\b/)?.[1] ?? '';

describe('A signed-in user reads their session summary', () => {
  let t: TestApp;
  let sms: InMemorySmsSender;
  let db: DataSource;

  async function signUp(browser: Browser, phone: string, e164: string, name: string, email?: string) {
    await browser.post('/api/public/sign-up/code', { phone, acceptedTerms: true });
    const res = await browser.post('/api/public/sign-up', {
      phone,
      code: codeIn(sms.lastTo(e164)),
      name,
      email,
      password: PASSWORD,
      acceptedTerms: true,
    });
    browser.useCsrfToken(res.body.data.csrfToken as string);
    return res.body.data.userId as string;
  }

  beforeAll(async () => {
    sms = new InMemorySmsSender();
    t = await startTestApp({ overrides: [[SMS_SENDER, sms]] });
    db = t.moduleRef.get(getDataSourceToken());
  });
  afterAll(() => t.close());

  it('refuses to answer without a session', async () => {
    const res = await t.browser().get('/api/salon/session');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('gives the name, no salon, no system role and leads a newcomer to create their organisation', async () => {
    const browser = t.browser();
    const userId = await signUp(
      browser,
      '6 77 12 34 56',
      '+237677123456',
      'Mireille Ndongo',
      'mireille@example.com',
    );

    const res = await browser.get('/api/salon/session');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      user: { id: userId, name: 'Mireille Ndongo' },
      activeSalonId: null,
      salons: [],
      permissions: [],
      systemRoles: [],
      nextStep: 'CREATE_ORGANIZATION',
    });
    expect(SessionSummarySchema.safeParse(res.body.data).success).toBe(true);
  });

  it('includes only the permissions of the user role in the active salon, and none without an active salon (T23)', async () => {
    const ownerBrowser = t.browser();
    await signUp(ownerBrowser, '6 70 00 00 51', '+237670000051', 'Mireille Ndongo');
    const created = await ownerBrowser.post('/api/salon/organizations', {
      name: 'Go Beauty Akwa',
      type: 'MIXED',
      city: 'Douala',
      district: 'Akwa',
      landmark: 'Face à la pharmacie du Centre',
      phone: '6 99 88 77 66',
    });
    const salonId = created.body.data.salonId as string;

    const awaBrowser = t.browser();
    const awaId = await signUp(awaBrowser, '6 70 00 00 52', '+237670000052', 'Awa Tchoua');
    await db.query(
      `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
       VALUES (gen_random_uuid(), $1, $2, 'HAIRDRESSER', 'ACTIVE', now(), 1)`,
      [salonId, awaId],
    );

    const beforeOpen = await awaBrowser.get('/api/salon/session');
    expect(beforeOpen.status).toBe(200);
    expect(beforeOpen.body.data.activeSalonId).toBeNull();
    expect(beforeOpen.body.data.permissions).toEqual([]);

    const opened = await awaBrowser.post('/api/salon/session/active-salon', { salonId });
    expect(opened.status).toBe(200);
    awaBrowser.useCsrfToken(opened.body.data.csrfToken);

    const afterOpen = await awaBrowser.get('/api/salon/session');
    expect(afterOpen.status).toBe(200);
    expect(afterOpen.body.data.activeSalonId).toBe(salonId);
    expect(afterOpen.body.data.permissions).toEqual(['bookings:view-own', 'availability:edit-own']);
    expect(SessionSummarySchema.safeParse(afterOpen.body.data).success).toBe(true);
  });

  it('never exposes the phone number nor the e-mail address', async () => {
    const browser = t.browser();
    await signUp(browser, '6 70 00 00 21', '+237670000021', 'Awa Ngono', 'awa.ngono@example.com');

    const res = await browser.get('/api/salon/session');

    expect(JSON.stringify(res.body)).not.toMatch(/670000021|awa\.ngono/);
  });

  it('shows each user their own summary, never the one of another account', async () => {
    const first = t.browser();
    const second = t.browser();
    await signUp(first, '6 70 00 00 31', '+237670000031', 'Paul Ebode');
    const secondId = await signUp(second, '6 70 00 00 32', '+237670000032', 'Awa Ngono');

    const res = await second.get('/api/salon/session');

    expect(res.body.data.user).toEqual({ id: secondId, name: 'Awa Ngono' });
  });

  it('answers 401 when the account disappeared while the session was still open', async () => {
    const browser = t.browser();
    const userId = await signUp(browser, '6 70 00 00 41', '+237670000041', 'Compte Supprimé');
    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);

    const res = await browser.get('/api/salon/session');

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});
