import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../infrastructure/config/env.schema.js';

const b64 = (n: number) => randomBytes(n).toString('base64');
const validLocal = {
  APP_ENV: 'local',
  API_PUBLIC_URL: 'http://localhost:10400',
  WEB_ORIGIN: 'http://localhost:10401',
  WEB_PUBLIC_URL: 'http://localhost:10401',
  DB_HOST: '127.0.0.1',
  DB_NAME: 'gomecoiffer',
  DB_USER: 'gomecoiffer',
  DB_PASSWORD: 'a-long-enough-password',
  SESSION_SECRET: b64(64),
  CSRF_SECRET: b64(48),
  TOKEN_HASH_PEPPER: b64(48),
  APP_ENCRYPTION_KEY: b64(32),
  PAYMENT_WEBHOOK_SECRET: b64(48),
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '10404',
  MAIL_FROM: 'GoMeCoiffer <no-reply@gomecoiffer.local>',
};

describe('Starting the API with its configuration', () => {
  it('starts with a complete local configuration', () => {
    expect(parseEnv(validLocal).WEB_ORIGIN).toEqual(['http://localhost:10401']);
  });

  it('refuses to start with a placeholder secret copied from the example file', () => {
    expect(() => parseEnv({ ...validLocal, SESSION_SECRET: '<secret-genere-64-octets-base64>' })).toThrow(
      /SESSION_SECRET/,
    );
  });

  it('refuses to start in production with insecure cookies, no TLS to the database or the fake payment provider', () => {
    const run = () => parseEnv({ ...validLocal, APP_ENV: 'prod' });
    expect(run).toThrow(/COOKIE_SECURE/);
    expect(run).toThrow(/DB_SSL/);
    expect(run).toThrow(/PAYMENT_PROVIDER/);
  });

  it('never repeats the value of a secret in its error message', () => {
    const weak = 'c2hvcnQ=';
    expect(() => parseEnv({ ...validLocal, CSRF_SECRET: weak })).toThrow(expect.not.stringContaining(weak));
  });
});
