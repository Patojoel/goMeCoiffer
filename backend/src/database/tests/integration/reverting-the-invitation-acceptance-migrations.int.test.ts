import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';

describe('The migrations of the invitation acceptance', () => {
  let t: TestApp;
  let db: DataSource;
  const proofsTable = async () =>
    (await db.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'phone_proofs'`)).length === 1;
  const acceptedByColumn = async () =>
    (
      await db.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'salon_invitations' AND column_name = 'accepted_by_user_id'`,
      )
    ).length === 1;
  const pendingPhoneIndex = async () =>
    (await db.query(`SELECT 1 FROM pg_indexes WHERE indexname = 'salon_invitations_pending_phone_idx'`)).length === 1;

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
  });
  afterAll(() => t.close());

  it('removes the proofs table, then the acceptance column and index, when reverted, and restores them when replayed', async () => {
    expect([await proofsTable(), await acceptedByColumn(), await pendingPhoneIndex()]).toEqual([true, true, true]);

    await db.undoLastMigration(); // plateforme, gestion d'équipe et nom de salon unique d'abord
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration(); // puis IdentityHolderSince + OrganizationsSalonRolePermissions
    await db.undoLastMigration();
    await db.undoLastMigration();
    expect([await proofsTable(), await acceptedByColumn()]).toEqual([false, true]);
    await db.undoLastMigration();
    expect([await acceptedByColumn(), await pendingPhoneIndex()]).toEqual([false, false]);

    await db.runMigrations();
    expect([await proofsTable(), await acceptedByColumn(), await pendingPhoneIndex()]).toEqual([true, true, true]);
  });
});
