import type { MigrationInterface, QueryRunner } from 'typeorm';

/** UC-001 : comptes (une identité par numéro) et défis SMS (un seul actif par numéro et par motif). */
export class IdentityAccounts1795000100000 implements MigrationInterface {
  name = 'IdentityAccounts1795000100000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE users (
        id                uuid PRIMARY KEY,
        phone             text        NOT NULL,
        name              text,
        email             text,
        password_hash     text,
        phone_verified_at timestamptz,
        terms_accepted_at timestamptz,
        created_at        timestamptz NOT NULL,
        updated_at        timestamptz NOT NULL DEFAULT now(),
        version           integer     NOT NULL,
        CONSTRAINT users_phone_key UNIQUE (phone)
      )`);

    await q.query(`
      CREATE TABLE otp_challenges (
        id          uuid PRIMARY KEY,
        phone       text        NOT NULL,
        purpose     text        NOT NULL CHECK (purpose IN ('SIGN_UP', 'PASSWORD_RESET', 'INVITATION', 'CLIENT_LOGIN')),
        code_hash   text        NOT NULL,
        status      text        NOT NULL CHECK (status IN ('ACTIVE', 'CONSUMED', 'SUPERSEDED')),
        sent_at     timestamptz NOT NULL,
        expires_at  timestamptz NOT NULL,
        attempts    integer     NOT NULL DEFAULT 0,
        consumed_at timestamptz,
        version     integer     NOT NULL
      )`);
    await q.query(
      `CREATE UNIQUE INDEX otp_challenges_one_active_idx ON otp_challenges (phone, purpose) WHERE status = 'ACTIVE'`,
    );
    await q.query(`CREATE INDEX otp_challenges_phone_sent_idx ON otp_challenges (phone, sent_at DESC)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE otp_challenges`);
    await q.query(`DROP TABLE users`);
  }
}
