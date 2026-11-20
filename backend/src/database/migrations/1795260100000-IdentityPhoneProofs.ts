import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-007 : preuve qu'un navigateur contrôle un numéro (15 minutes). Seule l'empreinte du jeton est stockée ; l'unicité
 * de l'empreinte sert la recherche à chaque requête, l'index sur l'échéance sert la tâche de purge.
 */
export class IdentityPhoneProofs1795260100000 implements MigrationInterface {
  name = 'IdentityPhoneProofs1795260100000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE phone_proofs (
        id         uuid PRIMARY KEY,
        token_hash text        NOT NULL,
        phone      text        NOT NULL,
        purpose    text        NOT NULL CHECK (purpose IN ('SIGN_UP', 'PASSWORD_RESET', 'INVITATION', 'CLIENT_LOGIN')),
        proven_at  timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        CONSTRAINT phone_proofs_token_hash_key UNIQUE (token_hash)
      )`);
    await q.query(`CREATE INDEX phone_proofs_expires_idx ON phone_proofs (expires_at)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE phone_proofs`);
  }
}
