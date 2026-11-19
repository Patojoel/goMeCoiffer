import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { DataSource } from 'typeorm';
import { type Browser } from '../../../../test-support/test-app.js';

export const sessionCookieOf = (res: { headers: Record<string, unknown> }) =>
  ([] as string[])
    .concat((res.headers['set-cookie'] as string[] | undefined) ?? [])
    .find((c) => c.startsWith('gmc.sid='))
    ?.split(';')[0];

export const PASSWORD = 'Akwa-Tresses-2026';
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export interface StaffAccount {
  readonly id: string;
  readonly name: string;
  readonly e164: string;
  /** Numéro tel que le tape l'utilisateur : « 6 70 00 01 23 ». */
  readonly typed: string;
}

/** Comptes du personnel insérés directement (numéro propre à chaque compte) puis connectés par la vraie route. */
export class StaffAccounts {
  private nextPhone = 670_000_100;
  private passwordHash: Promise<string> | undefined;

  constructor(private readonly db: DataSource) {}

  async create(name: string, options: { password?: boolean } = {}): Promise<StaffAccount> {
    const national = String(this.nextPhone++);
    const id = randomUUID();
    this.passwordHash ??= hash(PASSWORD, ARGON2);
    await this.db.query(
      `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, created_at, version)
       VALUES ($1, $2, $3, $4, now(), now(), 1)`,
      [id, `+237${national}`, name, options.password === false ? null : await this.passwordHash],
    );
    const typed = `${national[0]} ${national.slice(1, 3)} ${national.slice(3, 5)} ${national.slice(5, 7)} ${national.slice(7)}`;
    return { id, name, e164: `+237${national}`, typed };
  }

  async signIn(browser: Browser, account: StaffAccount) {
    const res = await browser.post('/api/public/auth/sign-in', { phone: account.typed, password: PASSWORD });
    browser.useCsrfToken(res.body.data.csrfToken);
    return res;
  }

  /** Compte créé et connecté ; renvoie aussi le jeton CSRF reçu à la connexion. */
  async signedIn(browser: Browser, name: string) {
    const account = await this.create(name);
    const res = await this.signIn(browser, account);
    return { account, csrfToken: res.body.data.csrfToken as string, sid: sessionCookieOf(res) };
  }
}
