import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { READ_DB, type SqlReader } from '../../application/ports.js';
import { sql } from '../../application/sql.js';
import { NotFoundError } from '../../domain/errors.js';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';

describe('Reading the database with pure SQL', () => {
  let t: TestApp;
  let db: SqlReader;

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(READ_DB);
    await t.moduleRef.get<DataSource>(getDataSourceToken()).query(
      `INSERT INTO audit_log (id, action, subject_type, occurred_at)
       VALUES ('0195f000-0000-7000-8000-000000000001', 'BOOKING_CANCELLED', 'booking', now())`,
    );
  });
  afterAll(() => t.close());

  it('starts on a schema built by the real migrations, with none left to apply', async () => {
    expect(await t.moduleRef.get<DataSource>(getDataSourceToken()).showMigrations()).toBe(false);
  });

  it('treats an injected value as data, never as SQL', async () => {
    const injected = "x' OR '1'='1";
    expect(await db.many(sql`SELECT action FROM audit_log WHERE action = ${injected}`)).toEqual([]);
    expect(await db.many(sql`SELECT action FROM audit_log WHERE action = ${'BOOKING_CANCELLED'}`)).toEqual([
      { action: 'BOOKING_CANCELLED' },
    ]);
  });

  it('reports a missing row as not found when exactly one is expected', async () => {
    await expect(
      db.one(sql`SELECT action FROM audit_log WHERE action = ${'NOTHING'}`),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
