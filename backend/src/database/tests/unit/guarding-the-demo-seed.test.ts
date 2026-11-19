import { describe, expect, it } from 'vitest';
import { seedRefusal } from '../../seed/seed-guard.js';

const local = { APP_ENV: 'local', NODE_ENV: 'development', DB_SSL: false, DB_HOST: 'localhost' } as const;

describe('Guarding the demo seed, which creates accounts with a known password', () => {
  it('runs on a local setup', () => {
    expect(seedRefusal(local)).toBeNull();
  });

  it.each(['localhost', '127.0.0.1', '::1'])('runs against the local database host %s', (DB_HOST) => {
    expect(seedRefusal({ ...local, DB_HOST })).toBeNull();
  });

  it.each([
    ['APP_ENV', { APP_ENV: 'prod' }],
    ['APP_ENV', { APP_ENV: 'preprod' }],
    ['NODE_ENV', { NODE_ENV: 'production' }],
    ['DB_SSL', { DB_SSL: true }],
    ['DB_HOST', { DB_HOST: 'db.internal.example' }],
  ] as const)('refuses on %s and names only the condition', (condition, over) => {
    expect(seedRefusal({ ...local, ...over } as never)).toBe(condition);
  });
});
