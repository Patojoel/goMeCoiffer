import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-008 : permissions ajustables des quatre rôles de collaborateur, par salon. Les permissions par défaut sont
 * recopiées pour chaque salon existant (RG-008-05, D-051) ; la clé primaire `(salon_id, role)` couvre la lecture des
 * droits à chaque requête, le contrôle d'invitation et l'écran des rôles.
 */
export class OrganizationsSalonRolePermissions1795300000000 implements MigrationInterface {
  name = 'OrganizationsSalonRolePermissions1795300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE salon_role_permissions (
        salon_id    uuid        NOT NULL REFERENCES salons (id) ON DELETE CASCADE,
        role        text        NOT NULL CHECK (role IN ('SALON_ADMIN', 'HAIRDRESSER', 'FINANCE_MANAGER', 'PRACTITIONER')),
        permissions text[]      NOT NULL CHECK (
          permissions <@ ARRAY[
            'dashboard:view',
            'bookings:view-own',
            'bookings:view-all',
            'bookings:manage',
            'availability:edit-own',
            'availability:manage-team',
            'services:view',
            'services:manage',
            'staff:view',
            'staff:invite',
            'staff:manage',
            'finances:view',
            'finances:record-payment',
            'finances:export',
            'salon-settings:view',
            'salon-settings:edit'
          ]::text[]
        ),
        version     integer     NOT NULL DEFAULT 1,
        updated_at  timestamptz NOT NULL DEFAULT now(),
        updated_by  uuid        REFERENCES users (id),
        PRIMARY KEY (salon_id, role)
      )`);

    await q.query(`
      INSERT INTO salon_role_permissions (salon_id, role, permissions, version, updated_at, updated_by)
      SELECT s.id, d.role, d.permissions, 1, s.created_at, NULL
      FROM salons s
      CROSS JOIN (
        VALUES
          (
            'SALON_ADMIN',
            ARRAY[
              'dashboard:view',
              'bookings:view-own',
              'bookings:view-all',
              'bookings:manage',
              'availability:edit-own',
              'availability:manage-team',
              'services:view',
              'services:manage',
              'staff:view',
              'staff:invite',
              'staff:manage',
              'salon-settings:view'
            ]::text[]
          ),
          ('HAIRDRESSER', ARRAY['bookings:view-own', 'availability:edit-own']::text[]),
          (
            'FINANCE_MANAGER',
            ARRAY[
              'dashboard:view',
              'bookings:view-all',
              'finances:view',
              'finances:record-payment',
              'finances:export'
            ]::text[]
          ),
          ('PRACTITIONER', ARRAY['bookings:view-own', 'availability:edit-own']::text[])
      ) AS d(role, permissions)
      ON CONFLICT (salon_id, role) DO NOTHING`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE salon_role_permissions`);
  }
}

