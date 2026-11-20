import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';

describe('The holder_since migration of users', () => {
  let t: TestApp;
  let db: DataSource;

  const holderSinceColumn = async () =>
    (
      await db.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'holder_since'`,
      )
    ).length === 1;

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
  });
  afterAll(() => t?.close());

  it('removes the holder_since column when reverted and backfills it from phone_verified_at or created_at when replayed', async () => {
    expect(await holderSinceColumn()).toBe(true);

    while (await holderSinceColumn()) await db.undoLastMigration();
    expect(await holderSinceColumn()).toBe(false);

    const verifiedAt = new Date('2026-10-15T08:00:00Z');
    const createdAt = new Date('2026-10-01T08:00:00Z');
    await db.query(
      `INSERT INTO users (id, phone, phone_verified_at, created_at, version)
       VALUES ('0195f000-0000-7000-8000-000000000901', '+237690000001', $1, $2, 1),
              ('0195f000-0000-7000-8000-000000000902', '+237690000002', NULL, $2, 1)`,
      [verifiedAt, createdAt],
    );

    await db.runMigrations();
    expect(await holderSinceColumn()).toBe(true);

    const rows = await db.query(
      `SELECT phone, holder_since AS "holderSince" FROM users WHERE phone IN ('+237690000001', '+237690000002') ORDER BY phone`,
    );
    expect(rows).toEqual([
      { phone: '+237690000001', holderSince: verifiedAt },
      { phone: '+237690000002', holderSince: createdAt },
    ]);
  });
});
