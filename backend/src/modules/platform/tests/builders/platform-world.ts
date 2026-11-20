import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import type { DataSource } from 'typeorm';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { Browser } from '../../../../test-support/test-app.js';
import type { SystemRole } from '../../domain/enums/system-role.enum.js';

export const DEMO_STAFF_PASSWORD = 'Platform-Admin-2026';
const ARGON2 = { memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export interface TestUser {
  readonly id: string;
  readonly name: string | null;
  readonly e164: string;
  readonly typed: string;
  readonly masked: string;
}

export const sessionCookieOf = (res: { headers: Record<string, unknown> }) =>
  ([] as string[])
    .concat((res.headers['set-cookie'] as string[] | undefined) ?? [])
    .find((c) => c.startsWith('gmc.sid='))
    ?.split(';')[0];

export class PlatformWorld {
  private passwordHash: Promise<string> | undefined;

  constructor(private readonly db: DataSource) {}

  async createUser(input: {
    phone: string;
    name: string | null;
    hasPassword?: boolean;
  }): Promise<TestUser> {
    const parsed = PhoneNumber.parse(input.phone);
    const id = randomUUID();
    this.passwordHash ??= hash(DEMO_STAFF_PASSWORD, ARGON2);
    await this.db.query(
      `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, holder_since, terms_accepted_at, created_at, version)
       VALUES ($1, $2, $3, $4, now(), now(), now(), now(), 1)`,
      [id, parsed.value, input.name, input.hasPassword === false ? null : await this.passwordHash],
    );
    return {
      id,
      name: input.name,
      e164: parsed.value,
      typed: input.phone,
      masked: parsed.masked(),
    };
  }

  async assignSystemRole(
    userId: string,
    role: SystemRole,
    grantedAt: Date,
    grantedByUserId: string | null = null,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO platform_admin_roles (user_id, role, granted_at, granted_by_user_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, role, grantedAt, grantedByUserId],
    );
  }

  async createSalonWithOwner(ownerId: string, name: string, phone: string): Promise<string> {
    const orgId = randomUUID();
    const salonId = randomUUID();
    await this.db.query(
      `INSERT INTO organizations (id, owner_user_id, name, created_at, version)
       VALUES ($1, $2, $3, now(), 1)`,
      [orgId, ownerId, name],
    );
    await this.db.query(
      `INSERT INTO salons (id, organization_id, name, type, city, district, landmark, phone, created_at, version)
       VALUES ($1, $2, $3, 'MIXED', 'Douala', 'Akwa', 'Rue Joffre', $4, now(), 1)`,
      [salonId, orgId, name, phone],
    );
    await this.db.query(
      `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', now(), 1)`,
      [randomUUID(), salonId, ownerId],
    );
    return salonId;
  }

  async addSalonMembership(salonId: string, userId: string, role: string): Promise<void> {
    await this.db.query(
      `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
       VALUES ($1, $2, $3, $4, 'ACTIVE', now(), 1)`,
      [randomUUID(), salonId, userId, role],
    );
  }

  async signInStaff(browser: Browser, user: TestUser) {
    const res = await browser.post('/api/public/auth/sign-in', {
      phone: user.typed,
      password: DEMO_STAFF_PASSWORD,
    });
    const csrfToken = res.body.data.csrfToken as string;
    browser.useCsrfToken(csrfToken);
    return { res, csrfToken, sid: sessionCookieOf(res) };
  }

  async deleteWithCsrf(browser: Browser, path: string, csrfToken: string) {
    return browser.agent.delete(path).set('x-csrf-token', csrfToken);
  }
}

