import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';

describe('The organizations migration', () => {
  let t: TestApp;
  let db: DataSource;
  const tables = async () =>
    (
      await db.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name IN ('organizations', 'salons', 'salon_memberships')
         ORDER BY table_name`,
      )
    ).map((r: { table_name: string }) => r.table_name);

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
  });
  afterAll(() => t.close());

  it('removes its three tables when reverted and creates them again when replayed', async () => {
    expect(await tables()).toEqual(['organizations', 'salon_memberships', 'salons']);

    await db.undoLastMigration(); // plateforme, gestion d'équipe et nom de salon unique d'abord
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration(); // holder_since, salon_role_permissions, preuves, acceptation, puis invitations (FK)
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration();
    expect(await tables()).toEqual([]);

    await db.runMigrations();
    expect(await tables()).toEqual(['organizations', 'salon_memberships', 'salons']);
  });
});
