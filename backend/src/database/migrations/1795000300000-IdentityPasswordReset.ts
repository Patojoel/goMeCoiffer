import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-003 : réinitialisation du mot de passe. Version des identifiants du compte (comparée à celle de la session à
 * chaque requête : une session ouverte avant la réinitialisation est refusée), marque « réinitialisation » dans
 * l'historique des essais (lève les blocages du numéro), et index des sessions par utilisateur (fermeture).
 */
export class IdentityPasswordReset1795000300000 implements MigrationInterface {
  name = 'IdentityPasswordReset1795000300000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN credentials_version integer NOT NULL DEFAULT 1`);
    await q.query(`ALTER TABLE sign_in_attempts ADD COLUMN password_reset boolean NOT NULL DEFAULT false`);
    // `DELETE FROM sessions WHERE sess->>'userId' = $1` : sans cet index, un balayage de toute la table.
    await q.query(`CREATE INDEX sessions_user_idx ON sessions ((sess->>'userId'))`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX sessions_user_idx`);
    await q.query(`ALTER TABLE sign_in_attempts DROP COLUMN password_reset`);
    await q.query(`ALTER TABLE users DROP COLUMN credentials_version`);
  }
}
