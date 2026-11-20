import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-011 : suivi du retrait et de la réintégration d'un collaborateur dans `salon_memberships` (D-057).
 * Index partiel `(salon_id) WHERE status = 'ACTIVE'` pour lister l'équipe active d'un salon sans balayer les
 * appartenances révoquées.
 */
export class OrganizationsTeamManagement1795310100000 implements MigrationInterface {
  name = 'OrganizationsTeamManagement1795310100000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE salon_memberships
        ADD COLUMN revoked_at         timestamptz,
        ADD COLUMN revoked_by_user_id uuid REFERENCES users (id),
        ADD COLUMN reinstated_at      timestamptz
    `);
    await q.query(
      `CREATE INDEX salon_memberships_salon_active_idx ON salon_memberships (salon_id) WHERE status = 'ACTIVE'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX salon_memberships_salon_active_idx`);
    await q.query(`
      ALTER TABLE salon_memberships
        DROP COLUMN reinstated_at,
        DROP COLUMN revoked_by_user_id,
        DROP COLUMN revoked_at
    `);
  }
}

