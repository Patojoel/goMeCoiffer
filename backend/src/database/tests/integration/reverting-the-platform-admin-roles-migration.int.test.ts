import { randomUUID } from 'node:crypto';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';

describe('The platform_admin_roles migration (T9)', () => {
  let t: TestApp;
  let db: DataSource;

  const tableExists = async () =>
    (
      await db.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_admin_roles'`,
      )
    ).length === 1;

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
  });
  afterAll(() => t?.close());

  it('reverts cleanly, replays cleanly, and enforces PK (user_id, role), FK users(id), CHECK on 3 roles, and role index', async () => {
    expect(await tableExists()).toBe(true);

    let undone = 0;
    while ((await tableExists()) && undone < 5) {
      await db.undoLastMigration();
      undone += 1;
    }
    expect(await tableExists()).toBe(false);

    await db.runMigrations();
    expect(await tableExists()).toBe(true);

    const indexes: Array<{ indexname: string; indexdef: string }> = await db.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'platform_admin_roles' ORDER BY indexname`,
    );
    expect(indexes.map((idx) => idx.indexname)).toEqual([
      'platform_admin_roles_pkey',
      'platform_admin_roles_role_idx',
    ]);

    const userId = randomUUID();
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, created_at, version)
       VALUES ($1, '+237690112233', 'Henri Ondoa', 'hash', now(), 1)`,
      [userId],
    );

    await db.query(
      `INSERT INTO platform_admin_roles (user_id, role, granted_at, granted_by_user_id)
       VALUES ($1, 'SUPER_ADMIN', now(), NULL)`,
      [userId],
    );

    await expect(
      db.query(
        `INSERT INTO platform_admin_roles (user_id, role, granted_at, granted_by_user_id)
         VALUES ($1, 'SUPER_ADMIN', now(), NULL)`,
        [userId],
      ),
    ).rejects.toThrow(/platform_admin_roles_pkey/);

    await expect(
      db.query(
        `INSERT INTO platform_admin_roles (user_id, role, granted_at, granted_by_user_id)
         VALUES ($1, 'OWNER', now(), NULL)`,
        [userId],
      ),
    ).rejects.toThrow(/platform_admin_roles_role_check/);

    await expect(
      db.query(
        `INSERT INTO platform_admin_roles (user_id, role, granted_at, granted_by_user_id)
         VALUES ($1, 'OPERATIONS_ADMIN', now(), NULL)`,
        [randomUUID()],
      ),
    ).rejects.toThrow(/platform_admin_roles_user_id_fkey/);
  });
});

