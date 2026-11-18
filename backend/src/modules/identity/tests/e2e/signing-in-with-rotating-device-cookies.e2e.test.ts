import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';

/** Plafond par adresse abaissé pour ce fichier : le même comportement qu'à 600/h, en 41 requêtes. */
const ADDRESS_LIMIT = 40;

describe('Trying passwords from one address while rotating forged device cookies', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await startTestApp({ env: { SIGN_IN_ADDRESS_RATE_LIMIT_PER_HOUR: String(ADDRESS_LIMIT) } });
  });
  afterAll(() => t.close());

  it('ends up refused by the per-address cap, since forged cookies each get their own device counter', async () => {
    const browser = t.browser();
    const statuses: number[] = [];

    for (let i = 0; i <= ADDRESS_LIMIT; i++) {
      const forged = i.toString(36).padStart(43, 'a');
      browser.agent.jar.setCookie(`gmc.device=${forged}`, '127.0.0.1', '/');
      const res = await browser.post('/api/public/auth/sign-in', {
        phone: '6 70 00 00 01',
        password: 'Wrong-guess-1-ok',
      });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, ADDRESS_LIMIT).every((status) => status === 422)).toBe(true);
    expect(statuses[ADDRESS_LIMIT]).toBe(429);
  });
});
