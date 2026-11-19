import { hash } from '@node-rs/argon2';
import type { DataSource } from 'typeorm';
import { ARGON2_OPTIONS } from '../../modules/identity/infrastructure/crypto/secrets.js';
import type { Seeder } from './seeder.js';

/** Mot de passe de démonstration, valable en local seulement (le seed refuse de tourner ailleurs). */
export const DEMO_PASSWORD = 'Demo-Salon-2026';

export const DEMO_USERS = [
  { id: '0195f000-0000-7000-8000-000000000a01', phone: '+237677123456', name: 'Mireille Ndongo' },
  { id: '0195f000-0000-7000-8000-000000000a02', phone: '+237699001122', name: 'Paul Ebode' },
] as const;

/** Comptes du personnel de démo, numéro vérifié ; clé d'idempotence : le numéro. */
export const identitySeeder: Seeder = {
  name: 'identity',
  async run(dataSource: DataSource) {
    const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS);
    for (const user of DEMO_USERS)
      await dataSource.query(
        `INSERT INTO users (id, phone, name, password_hash, phone_verified_at, terms_accepted_at, created_at, version)
         VALUES ($1, $2, $3, $4, now(), now(), now(), 1)
         ON CONFLICT (phone) DO NOTHING`,
        [user.id, user.phone, user.name, passwordHash],
      );
  },
};
