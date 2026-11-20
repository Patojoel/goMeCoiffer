import { randomUUID } from 'node:crypto';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ADJUSTABLE_SALON_ROLES } from '../../../modules/organizations/domain/enums/permission.enum.js';
import { defaultPermissionsOf } from '../../../modules/organizations/domain/value-objects/role-permission-set.js';
import { startTestApp, type TestApp } from '../../../test-support/test-app.js';

describe('The salon_role_permissions migration (T12)', () => {
  let t: TestApp;
  let db: DataSource;

  const tableExists = async () =>
    (
      await db.query(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'salon_role_permissions'`,
      )
    ).length === 1;

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
  });
  afterAll(() => t?.close());

  it('reverts cleanly, backfills default permissions for pre-existing salons when replayed, and enforces role and permission checks', async () => {
    expect(await tableExists()).toBe(true);

    // Dépile jusqu'à la migration salon_role_permissions (même si une migration plus récente existe après elle).
    let undone = 0;
    while ((await tableExists()) && undone < 5) {
      await db.undoLastMigration();
      undone += 1;
    }
    expect(await tableExists()).toBe(false);

    const ownerId = randomUUID();
    const orgId = randomUUID();
    const firstSalonId = randomUUID();
    const secondSalonId = randomUUID();
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, created_at, version)
       VALUES ($1, '+237690001234', 'Paul Ebode', 'hash', now(), 1)`,
      [ownerId],
    );
    await db.query(
      `INSERT INTO organizations (id, owner_user_id, name, created_at, version)
       VALUES ($1, $2, 'Paul Barber Deïdo', now(), 1)`,
      [orgId, ownerId],
    );
    for (const [salonId, name, phone] of [
      [firstSalonId, 'Paul Barber Deïdo', '+237690001235'],
      [secondSalonId, 'Paul Barber Bonapriso', '+237690001236'],
    ] as const) {
      await db.query(
        `INSERT INTO salons (id, organization_id, name, type, city, district, landmark, phone, created_at, version)
         VALUES ($1, $2, $3, 'BARBER_SHOP', 'Douala', 'Deïdo', 'Rond-point Deïdo', $4, now(), 1)`,
        [salonId, orgId, name, phone],
      );
    }

    await db.runMigrations();
    expect(await tableExists()).toBe(true);

    for (const salonId of [firstSalonId, secondSalonId]) {
      const rows: Array<{ role: string; permissions: string[]; version: number }> = await db.query(
        `SELECT role, permissions, version FROM salon_role_permissions WHERE salon_id = $1`,
        [salonId],
      );
      expect(rows).toHaveLength(4);
      for (const role of ADJUSTABLE_SALON_ROLES) {
        const row = rows.find((r) => r.role === role);
        expect(row).toEqual({
          role,
          permissions: defaultPermissionsOf(role),
          version: 1,
        });
      }
    }

    await expect(
      db.query(
        `INSERT INTO salon_role_permissions (salon_id, role, permissions, version, updated_at)
         VALUES ($1, 'OWNER', ARRAY[]::text[], 1, now())`,
        [firstSalonId],
      ),
    ).rejects.toThrow(/salon_role_permissions_role_check/);

    await expect(
      db.query(
        `UPDATE salon_role_permissions
         SET permissions = ARRAY['roles:administer']::text[]
         WHERE salon_id = $1 AND role = 'SALON_ADMIN'`,
        [firstSalonId],
      ),
    ).rejects.toThrow(/salon_role_permissions_permissions_check/);
  });
});

