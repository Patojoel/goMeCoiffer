import { randomUUID } from 'node:crypto';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { Argon2PasswordVerifier } from '../../infrastructure/crypto/secrets.js';

const PASSWORD = 'Bastos-Fade-2026';
/** Plafond par appareil abaissé pour ce fichier (100/h en production) ; au-dessus des 30 échecs de la limite par adresse. */
const DEVICE_LIMIT = 35;
const cookieNamed = (res: { headers: Record<string, unknown> }, name: string) =>
  ([] as string[])
    .concat((res.headers['set-cookie'] as string[] | undefined) ?? [])
    .find((c) => c.startsWith(`${name}=`));

describe('Signing in from a network address shared with strangers', () => {
  let t: TestApp;
  let db: DataSource;

  beforeAll(async () => {
    t = await startTestApp({
      env: {
        SIGN_IN_RATE_LIMIT_PER_HOUR: String(DEVICE_LIMIT),
        SIGN_IN_ADDRESS_RATE_LIMIT_PER_HOUR: '50',
      },
    });
    db = t.moduleRef.get(getDataSourceToken());
  });
  afterAll(() => t.close());

  it('does not lock a recognised device out through the per-address request cap, while a forged device cookie still meets the sign-in limits', async () => {
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, created_at, version)
       VALUES ($1, '+237699001122', 'Paul Ebode', $2, now(), now(), 1)`,
      [randomUUID(), await new Argon2PasswordVerifier().rehash(PASSWORD)],
    );
    const usualPhone = t.browser();
    const first = await usualPhone.post('/api/public/auth/sign-in', {
      phone: '6 99 00 11 22',
      password: PASSWORD,
    });
    expect(first.status).toBe(200);
    usualPhone.useCsrfToken(first.body.data.csrfToken);
    const deviceCookie = cookieNamed(first, 'gmc.device')?.split(';')[0] ?? '';

    // Des inconnus derrière la même adresse dépassent le plafond sans cookie d'appareil (dont 30 échecs sur des numéros variés).
    const strangers = t.browser();
    const statuses: number[] = [];
    for (let i = 0; i <= DEVICE_LIMIT; i++) {
      const res = await strangers.post('/api/public/auth/sign-in', {
        phone: `6 70 00 00 ${String(10 + (i % 30))}`,
        password: 'Wrong-guess-1-ok',
      });
      statuses.push(res.status);
    }

    const again = await usualPhone.post('/api/public/auth/sign-in', {
      phone: '6 99 00 11 22',
      password: PASSWORD,
    });
    const forged = t.browser();
    forged.agent.jar.setCookie(`gmc.device=${'a'.repeat(43)}`, '127.0.0.1', '/');
    const withForgedCookie = await forged.post('/api/public/auth/sign-in', {
      phone: '6 99 00 11 22',
      password: PASSWORD,
    });
    const strangerAfterCap = await strangers.post('/api/public/auth/sign-in', {
      phone: '6 70 00 00 99',
      password: 'Wrong-guess-1-ok',
    });

    expect(deviceCookie).toMatch(/^gmc\.device=/);
    expect(statuses.at(-1)).toBe(429);
    expect(strangerAfterCap.status).toBe(429);
    expect(again.status).toBe(200);
    expect(withForgedCookie.status).toBe(422);
    expect(withForgedCookie.body.code).toBe('SIGN_IN_TEMPORARILY_BLOCKED');
    expect(withForgedCookie.body.message).toMatch(/^Trop d'essais depuis ce réseau/);
  });
});
