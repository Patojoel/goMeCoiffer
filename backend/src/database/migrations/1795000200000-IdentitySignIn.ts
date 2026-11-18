import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC-002 : historique des essais de connexion (limites par numéro et par adresse, purgé après 48 h) et appareils
 * reconnus (un jeton par navigateur, reconnu séparément pour chaque compte).
 */
export class IdentitySignIn1795000200000 implements MigrationInterface {
  name = 'IdentitySignIn1795000200000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE sign_in_attempts (
        id                uuid PRIMARY KEY,
        phone             text        NOT NULL,
        network_address   text        NOT NULL,
        attempted_at      timestamptz NOT NULL,
        succeeded         boolean     NOT NULL,
        from_known_device boolean     NOT NULL
      )`);
    // Lecture par numéro sur 24 h (essais, réussites comprises).
    await q.query(`CREATE INDEX sign_in_attempts_phone_idx ON sign_in_attempts (phone, attempted_at DESC)`);
    // Lecture par adresse sur 1 h : seuls les échecs d'appareils non reconnus comptent.
    await q.query(`
      CREATE INDEX sign_in_attempts_network_failures_idx ON sign_in_attempts (network_address, attempted_at DESC)
      WHERE NOT succeeded AND NOT from_known_device`);
    // Purge des essais de plus de 48 h.
    await q.query(`CREATE INDEX sign_in_attempts_attempted_at_idx ON sign_in_attempts (attempted_at)`);

    await q.query(`
      CREATE TABLE known_devices (
        id              uuid PRIMARY KEY,
        user_id         uuid        NOT NULL REFERENCES users (id),
        token_hash      text        NOT NULL,
        recognized_at   timestamptz NOT NULL,
        last_used_at    timestamptz NOT NULL,
        expires_at      timestamptz NOT NULL,
        failed_attempts integer     NOT NULL DEFAULT 0,
        revoked_at      timestamptz,
        version         integer     NOT NULL,
        CONSTRAINT known_devices_token_user_key UNIQUE (token_hash, user_id)
      )`);
    await q.query(`CREATE INDEX known_devices_user_idx ON known_devices (user_id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE known_devices`);
    await q.query(`DROP TABLE sign_in_attempts`);
  }
}
