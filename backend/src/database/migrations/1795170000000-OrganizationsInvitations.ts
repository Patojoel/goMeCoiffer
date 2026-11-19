import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-006 : invitations de collaborateurs. Une seule invitation en attente par numéro et par salon, garantie par un
 * index unique partiel (RG-006-08, même à deux requêtes). Nom et numéro sont nullables : ils sont effacés 30 jours
 * après la fin d'une invitation non acceptée (RG-006-17) ; une invitation en attente garde son numéro.
 * `notified_by_sms` compte les SMS d'invitation par numéro (D-044) sans table d'historique séparée.
 */
export class OrganizationsInvitations1795170000000 implements MigrationInterface {
  name = 'OrganizationsInvitations1795170000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE salon_invitations (
        id                 uuid PRIMARY KEY,
        salon_id           uuid        NOT NULL REFERENCES salons (id),
        name               text,
        phone              text,
        role               text        NOT NULL
                           CHECK (role IN ('SALON_ADMIN', 'HAIRDRESSER', 'FINANCE_MANAGER', 'PRACTITIONER')),
        invited_by_user_id uuid        NOT NULL REFERENCES users (id),
        sent_at            timestamptz NOT NULL,
        expires_at         timestamptz NOT NULL,
        status             text        NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED')),
        ended_at           timestamptz,
        notified_by_sms    boolean     NOT NULL,
        version            integer     NOT NULL,
        CONSTRAINT salon_invitations_pending_has_contact CHECK (status <> 'PENDING' OR (name IS NOT NULL AND phone IS NOT NULL))
      )`);
    await q.query(
      `CREATE UNIQUE INDEX salon_invitations_one_pending_per_phone_key ON salon_invitations (salon_id, phone) WHERE status = 'PENDING'`,
    );
    // Liste du salon (plus récentes d'abord) et compteur des 24 h.
    await q.query(`CREATE INDEX salon_invitations_salon_sent_idx ON salon_invitations (salon_id, sent_at DESC)`);
    // Limite de SMS par numéro, tous salons confondus.
    await q.query(
      `CREATE INDEX salon_invitations_phone_sms_idx ON salon_invitations (phone, sent_at) WHERE notified_by_sms AND phone IS NOT NULL`,
    );
    // Tâche d'effacement : seulement ce qui porte encore un nom et n'a pas été accepté.
    await q.query(
      `CREATE INDEX salon_invitations_purge_idx ON salon_invitations ((COALESCE(ended_at, expires_at))) WHERE name IS NOT NULL AND status <> 'ACCEPTED'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE salon_invitations`);
  }
}
