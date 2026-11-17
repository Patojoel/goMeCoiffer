import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Socle : extension de non-chevauchement, outbox, idempotence des consommateurs, sessions, journal d'audit. */
export class Socle1795000000000 implements MigrationInterface {
  name = 'Socle1795000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await q.query(`
      CREATE TABLE outbox (
        id           uuid PRIMARY KEY,
        type         text        NOT NULL,
        payload      jsonb       NOT NULL,
        occurred_at  timestamptz NOT NULL,
        created_at   timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        attempts     integer     NOT NULL DEFAULT 0,
        last_error   text
      )`);
    await q.query(`CREATE INDEX outbox_pending_idx ON outbox (created_at) WHERE processed_at IS NULL`);

    await q.query(`
      CREATE TABLE processed_events (
        consumer     text        NOT NULL,
        event_id     uuid        NOT NULL,
        processed_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (consumer, event_id)
      )`);

    await q.query(`
      CREATE TABLE sessions (
        sid    varchar      NOT NULL PRIMARY KEY,
        sess   json         NOT NULL,
        expire timestamp(6) NOT NULL
      )`);
    await q.query(`CREATE INDEX sessions_expire_idx ON sessions (expire)`);

    await q.query(`
      CREATE TABLE audit_log (
        id            uuid PRIMARY KEY,
        salon_id      uuid,
        actor_user_id uuid,
        action        text        NOT NULL,
        subject_type  text        NOT NULL,
        subject_id    uuid,
        details       jsonb       NOT NULL DEFAULT '{}'::jsonb,
        occurred_at   timestamptz NOT NULL
      )`);
    await q.query(`CREATE INDEX audit_log_salon_idx ON audit_log (salon_id, occurred_at DESC)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE audit_log`);
    await q.query(`DROP TABLE sessions`);
    await q.query(`DROP TABLE processed_events`);
    await q.query(`DROP TABLE outbox`);
  }
}
