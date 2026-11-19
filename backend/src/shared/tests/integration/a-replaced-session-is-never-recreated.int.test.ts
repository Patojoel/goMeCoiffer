import pg from 'pg';
import session from 'express-session';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';
import { RotationSafePgStore } from '../../infrastructure/security/rotation-safe-session-store.js';

const call = <T>(run: (done: (err?: unknown, value?: T) => void) => void) =>
  new Promise<T | undefined>((resolve, reject) => run((err, value) => (err ? reject(err) : resolve(value))));

const cookie = { originalMaxAge: 60_000, expires: new Date(Date.now() + 60_000) } as session.Cookie;
const USER = '0195f000-0000-7000-8000-00000000a001';

describe('Storing sessions', () => {
  let t: TestApp;
  let pool: pg.Pool;
  let store: RotationSafePgStore;

  beforeAll(async () => {
    t = await startTestApp();
    const c = t.db.config;
    pool = new pg.Pool({
      host: c.DB_HOST,
      port: c.DB_PORT,
      database: c.DB_NAME,
      user: c.DB_USER,
      password: c.DB_PASSWORD,
      max: 2,
    });
    store = new RotationSafePgStore({ pool, tableName: 'sessions', createTableIfMissing: false });
  });
  afterAll(async () => {
    await pool.end();
    await t.close();
  });

  const save = (sid: string, data: object) =>
    call((done) => store.set(sid, { cookie, ...data } as session.SessionData, done));
  const stored = async (sid: string) => (await call((done) => store.get(sid, done))) as any;

  it('does not recreate a signed-in session that a rotation has destroyed, when a late request saves it', async () => {
    await save('S0', { userId: USER, freshlyIssued: true });
    await call((done) => store.destroy('S0', done));
    await save('S1', { userId: USER, activeSalonId: 'salon-b', freshlyIssued: true });

    await save('S0', { userId: USER, activeSalonId: 'salon-a' });

    expect(await stored('S0')).toBeUndefined();
    expect((await stored('S1')).activeSalonId).toBe('salon-b');
  });

  it('stores a newly issued signed-in session without keeping the issuing mark', async () => {
    await save('S2', { userId: USER, freshlyIssued: true });

    expect(await stored('S2')).toMatchObject({ userId: USER });
    expect((await stored('S2')).freshlyIssued).toBeUndefined();
  });

  it('keeps updating a session that still exists', async () => {
    await save('S3', { userId: USER, freshlyIssued: true });

    await save('S3', { userId: USER, activeSalonId: 'salon-c' });

    expect((await stored('S3')).activeSalonId).toBe('salon-c');
  });

  it('still stores the session of a visitor who is not signed in', async () => {
    await save('V1', { visitor: true });

    expect(await stored('V1')).toMatchObject({ visitor: true });
  });
});
