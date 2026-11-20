import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-009 : date de début de la titularité présumée du numéro (`holder_since`, D-053, RG-009-06). Lorsqu'une preuve de
 * possession du numéro arrive après plus de 180 jours sans preuve, `holder_since` avance à cet instant pour masquer
 * l'historique client de l'ancien titulaire. Pour les comptes existants, initialisée à `phone_verified_at` (ou
 * `created_at`).
 */
export class IdentityHolderSince1795300100000 implements MigrationInterface {
  name = 'IdentityHolderSince1795300100000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN holder_since timestamptz`);
    await q.query(
      `UPDATE users SET holder_since = COALESCE(phone_verified_at, created_at) WHERE holder_since IS NULL`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP COLUMN holder_since`);
  }
}

