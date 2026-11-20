import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-012 : rôles système GoMeCoiffer (`platform_admin_roles`), strictement séparés des rôles salon (PRD §4, D-058).
 * Clé primaire `(user_id, role)` : garantit le cumul sans doublon et sert `SqlActorRights` / `GetMySession`.
 * Index sur `(role)` : couvre le comptage des `SUPER_ADMIN` actifs et la liste des administrateurs.
 */
export class PlatformAdminRoles1795310200000 implements MigrationInterface {
  name = 'PlatformAdminRoles1795310200000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE platform_admin_roles (
        user_id            uuid        NOT NULL REFERENCES users (id),
        role               text        NOT NULL CHECK (role IN ('SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN')),
        granted_at         timestamptz NOT NULL,
        granted_by_user_id uuid        REFERENCES users (id),
        PRIMARY KEY (user_id, role)
      )`);
    await q.query(`CREATE INDEX platform_admin_roles_role_idx ON platform_admin_roles (role)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE platform_admin_roles`);
  }
}

