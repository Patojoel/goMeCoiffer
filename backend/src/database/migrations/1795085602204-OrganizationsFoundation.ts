import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-004 : organisations (un propriétaire = une organisation, garanti par l'unicité de `owner_user_id`, D-035),
 * salons (fuseau et statut de publication par défaut, D-036) et appartenances (un rôle par salon et utilisateur ;
 * les cinq rôles prédéfinis du PRD §5 ; UC-008 en fixera les permissions). Ville, type et rôle sont contraints en base :
 * un bug ou une écriture à la main ne peut pas fabriquer une valeur hors liste (D-036).
 */
export class OrganizationsFoundation1795085602204 implements MigrationInterface {
  name = 'OrganizationsFoundation1795085602204';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE organizations (
        id            uuid PRIMARY KEY,
        owner_user_id uuid        NOT NULL REFERENCES users (id),
        name          text        NOT NULL,
        created_at    timestamptz NOT NULL,
        version       integer     NOT NULL,
        CONSTRAINT organizations_owner_user_id_key UNIQUE (owner_user_id)
      )`);

    await q.query(`
      CREATE TABLE salons (
        id                 uuid PRIMARY KEY,
        organization_id    uuid        NOT NULL REFERENCES organizations (id),
        name               text        NOT NULL,
        type               text        NOT NULL CHECK (type IN ('HAIR_SALON', 'BARBER_SHOP', 'BEAUTY', 'MIXED')),
        city               text        NOT NULL CHECK (city IN ('Douala', 'Yaoundé', 'Bafoussam', 'Bamenda', 'Buea', 'Limbé', 'Kribi', 'Garoua', 'Maroua', 'Ngaoundéré', 'Bertoua', 'Ebolowa')),
        district           text        NOT NULL,
        landmark           text        NOT NULL,
        phone              text        NOT NULL,
        timezone           text        NOT NULL DEFAULT 'Africa/Douala',
        publication_status text        NOT NULL DEFAULT 'NOT_PUBLISHED'
                           CHECK (publication_status IN ('NOT_PUBLISHED', 'PUBLISHED')),
        created_at         timestamptz NOT NULL,
        version            integer     NOT NULL
      )`);
    await q.query(`CREATE INDEX salons_organization_idx ON salons (organization_id)`);

    await q.query(`
      CREATE TABLE salon_memberships (
        id         uuid PRIMARY KEY,
        salon_id   uuid        NOT NULL REFERENCES salons (id),
        user_id    uuid        NOT NULL REFERENCES users (id),
        role       text        NOT NULL
                   CHECK (role IN ('OWNER', 'SALON_ADMIN', 'HAIRDRESSER', 'FINANCE_MANAGER', 'PRACTITIONER')),
        status     text        NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED')),
        granted_at timestamptz NOT NULL,
        version    integer     NOT NULL,
        CONSTRAINT salon_memberships_salon_user_key UNIQUE (salon_id, user_id)
      )`);
    // Résumé de session : les salons actifs d'un utilisateur, sans balayer les appartenances révoquées.
    await q.query(`CREATE INDEX salon_memberships_user_active_idx ON salon_memberships (user_id) WHERE status = 'ACTIVE'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE salon_memberships`);
    await q.query(`DROP TABLE salons`);
    await q.query(`DROP TABLE organizations`);
  }
}
