import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { inject } from 'vitest';
import { type AppConfig, loadConfig } from '../shared/infrastructure/config/app-config.module.js';

export interface TestDatabase {
  readonly config: AppConfig;
  drop(): Promise<void>;
}

const b64 = (n: number) => randomBytes(n).toString('base64');

/** Base neuve clonée depuis la base modèle migrée : chaque fichier de test a la sienne. */
export async function createTestDatabase(env: Readonly<Record<string, string>> = {}): Promise<TestDatabase> {
  const server = inject('pg');
  const name = `t_${randomUUID().replaceAll('-', '')}`;
  const admin = () => new pg.Client({ ...server, database: 'postgres' });

  const client = admin();
  await client.connect();
  await client.query(`CREATE DATABASE ${name} TEMPLATE ${server.templateDatabase}`);
  await client.end();

  const config = loadConfig({
    APP_ENV: 'test',
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    API_PUBLIC_URL: 'http://localhost:10400',
    WEB_ORIGIN: 'http://localhost:10401',
    WEB_PUBLIC_URL: 'http://localhost:10401',
    DB_HOST: server.host,
    DB_PORT: String(server.port),
    DB_NAME: name,
    DB_USER: server.user,
    DB_PASSWORD: server.password,
    SESSION_SECRET: b64(64),
    CSRF_SECRET: b64(48),
    TOKEN_HASH_PEPPER: b64(48),
    APP_ENCRYPTION_KEY: b64(32),
    PAYMENT_WEBHOOK_SECRET: b64(48),
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1025',
    MAIL_FROM: 'GoMeCoiffer <test@gomecoiffer.local>',
    THROTTLE_LIMIT: '10000',
    ...env,
  });

  return {
    config,
    drop: async () => {
      const c = admin();
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}
