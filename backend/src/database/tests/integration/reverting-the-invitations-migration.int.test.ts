import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';

describe('The invitations migration', () => {
  let t: TestApp;
  let db: DataSource;
  const exists = async () =>
    (await db.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'salon_invitations'`)).length === 1;
  const pendingIndex = async () =>
    (await db.query(`SELECT indexdef FROM pg_indexes WHERE indexname = 'salon_invitations_one_pending_per_phone_key'`))[0]
      ?.indexdef as string | undefined;

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
  });
  afterAll(() => t.close());

  it('guarantees one pending invitation per number and salon with a partial unique index', async () => {
    expect(await pendingIndex()).toMatch(/UNIQUE INDEX .*\(salon_id, phone\) WHERE \(status = 'PENDING'::text\)/);
  });

  it('removes its table when reverted and creates it again when replayed', async () => {
    expect(await exists()).toBe(true);

    await db.undoLastMigration(); // l'acceptation des invitations (colonne et index) et les preuves de numéro d'abord
    await db.undoLastMigration();
    await db.undoLastMigration();
    expect(await exists()).toBe(false);

    await db.runMigrations();
    expect(await exists()).toBe(true);
  });
});
