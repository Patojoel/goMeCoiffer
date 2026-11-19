import type { DataSource } from 'typeorm';
import { DEMO_USERS } from './identity.seed.js';
import type { Seeder } from './seeder.js';

const MIREILLE = DEMO_USERS[0];
const ORGANIZATION_ID = '0195f000-0000-7000-8000-000000000b01';
const SALON_ID = '0195f000-0000-7000-8000-000000000b02';
const MEMBERSHIP_ID = '0195f000-0000-7000-8000-000000000b03';

/**
 * « Go Beauty Akwa » de Mireille (non publié, propriétaire). Paul n'a volontairement aucune organisation :
 * il déroule UC-004 en local. Clés d'idempotence : le propriétaire, le couple (salon, utilisateur).
 */
export const organizationsSeeder: Seeder = {
  name: 'organizations',
  async run(dataSource: DataSource) {
    await dataSource.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO organizations (id, owner_user_id, name, created_at, version)
         SELECT $1, u.id, 'Go Beauty Akwa', now(), 1 FROM users u WHERE u.phone = $2
         ON CONFLICT (owner_user_id) DO NOTHING`,
        [ORGANIZATION_ID, MIREILLE.phone],
      );
      await tx.query(
        `INSERT INTO salons (id, organization_id, name, type, city, district, landmark, phone, created_at, version)
         SELECT $1, o.id, 'Go Beauty Akwa', 'MIXED', 'Douala', 'Akwa',
                'Rue Joffre, face à la pharmacie du Centre', '+237699887766', now(), 1
         FROM organizations o JOIN users u ON u.id = o.owner_user_id WHERE u.phone = $2
         ON CONFLICT (id) DO NOTHING`,
        [SALON_ID, MIREILLE.phone],
      );
      await tx.query(
        `INSERT INTO salon_memberships (id, salon_id, user_id, role, status, granted_at, version)
         SELECT $1, s.id, u.id, 'OWNER', 'ACTIVE', now(), 1
         FROM salons s, users u WHERE s.id = $2 AND u.phone = $3
         ON CONFLICT (salon_id, user_id) DO NOTHING`,
        [MEMBERSHIP_ID, SALON_ID, MIREILLE.phone],
      );
    });
  },
};
