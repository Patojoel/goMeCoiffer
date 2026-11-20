import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-007 : acceptation d'une invitation. `accepted_by_user_id` garde le compte qui a accepté (le nom et le numéro
 * saisis par le salon sont effacés à l'acceptation, RG-007-12) ; l'index partiel sert la demande de code et la liste des
 * invitations en attente d'un numéro (l'index unique existant commence par `salon_id`, inutilisable ici).
 */
export class OrganizationsInvitationAcceptance1795260000000 implements MigrationInterface {
  name = 'OrganizationsInvitationAcceptance1795260000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE salon_invitations ADD COLUMN accepted_by_user_id uuid REFERENCES users (id)`);
    await q.query(
      `CREATE INDEX salon_invitations_pending_phone_idx ON salon_invitations (phone, sent_at DESC) WHERE status = 'PENDING'`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX salon_invitations_pending_phone_idx`);
    await q.query(`ALTER TABLE salon_invitations DROP COLUMN accepted_by_user_id`);
  }
}
