import { hash } from '@node-rs/argon2';
import type { DataSource } from 'typeorm';
import { ARGON2_OPTIONS } from '../../modules/identity/infrastructure/crypto/secrets.js';
import { DEMO_PASSWORD } from './identity.seed.js';
import type { Seeder } from './seeder.js';

export const DEMO_PLATFORM_ADMINS = [
  {
    id: '0195f000-0000-7000-8000-000000000c01',
    phone: '+237690112233',
    name: 'Henri Ondoa',
    role: 'SUPER_ADMIN',
  },
  {
    id: '0195f000-0000-7000-8000-000000000c02',
    phone: '+237692334455',
    name: 'Serge Kamga',
    role: 'OPERATIONS_ADMIN',
  },
] as const;

/**
 * Administrateurs plateforme de démo (UC-012) : Henri Ondoa (`SUPER_ADMIN`) et Serge Kamga (`OPERATIONS_ADMIN`).
 * Idempotent : clé d'unicité `users (phone)` puis `platform_admin_roles (user_id, role)`.
 */
export const platformSeeder: Seeder = {
  name: 'platform',
  async run(dataSource: DataSource) {
    const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS);
    await dataSource.transaction(async (tx) => {
      for (const admin of DEMO_PLATFORM_ADMINS) {
        await tx.query(
          `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, holder_since, terms_accepted_at, created_at, version)
           VALUES ($1, $2, $3, $4, now(), now(), now(), now(), 1)
           ON CONFLICT (phone) DO NOTHING`,
          [admin.id, admin.phone, admin.name, passwordHash],
        );
        await tx.query(
          `INSERT INTO platform_admin_roles (user_id, role, granted_at, granted_by_user_id)
           SELECT u.id, $2, now(), NULL
           FROM users u WHERE u.phone = $1
           ON CONFLICT (user_id, role) DO NOTHING`,
          [admin.phone, admin.role],
        );
      }
    });
  },
};

