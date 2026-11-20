import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { READ_DB, type SqlReader } from '../../../../../shared/application/ports.js';
import { sql } from '../../../../../shared/application/sql.js';
import {
  ADJUSTABLE_SALON_ROLES,
  type AdjustablePermission,
  RESERVED_OWNER_RIGHTS,
  SALON_PERMISSIONS,
} from '../../../domain/enums/permission.enum.js';
import { defaultPermissionsOf, RolePermissionSet } from '../../../domain/value-objects/role-permission-set.js';
import { GetSalonRoles } from './get-salon-roles.query.js';
import type { SalonRolesReadModel } from './get-salon-roles.read-model.js';

interface SalonRoleRow {
  readonly role: string;
  readonly permissions: readonly string[] | null;
  readonly version: number | null;
  readonly members: number;
}

/**
 * Rôles et permissions du salon actif (RG-008-17) : réglages configurés + nombre de membres actifs par rôle, sans
 * aucun nom ni numéro. CTE filtrées dès l'entrée par `salon_id`.
 * Index : clé primaire `salon_role_permissions (salon_id, role)` ; unicité `salon_memberships (salon_id, user_id)`.
 */
@QueryHandler(GetSalonRoles)
export class GetSalonRolesHandler implements IQueryHandler<GetSalonRoles> {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async execute(q: GetSalonRoles): Promise<SalonRolesReadModel> {
    const rows = await this.db.many<SalonRoleRow>(sql`
      WITH role_settings AS (
        SELECT role, permissions, version
        FROM salon_role_permissions
        WHERE salon_id = ${q.salonId}
      ),
      active_counts AS (
        SELECT role, count(*)::int AS members
        FROM salon_memberships
        WHERE salon_id = ${q.salonId} AND status = 'ACTIVE'
        GROUP BY role
      )
      SELECT
        COALESCE(s.role, c.role) AS role,
        s.permissions AS permissions,
        s.version AS version,
        COALESCE(c.members, 0)::int AS members
      FROM role_settings s
      FULL OUTER JOIN active_counts c ON c.role = s.role`);

    const byRole = new Map(rows.map((row) => [row.role, row]));

    return {
      owner: {
        permissions: [...SALON_PERMISSIONS],
        reservedRights: [...RESERVED_OWNER_RIGHTS],
        members: byRole.get('OWNER')?.members ?? 0,
      },
      roles: ADJUSTABLE_SALON_ROLES.map((role) => {
        const row = byRole.get(role);
        const permissions = (row?.permissions ?? []) as AdjustablePermission[];
        const defaults = defaultPermissionsOf(role);
        return {
          role,
          permissions: [...permissions],
          defaultPermissions: [...defaults],
          isDefault: RolePermissionSet.create(permissions).matchesDefaultOf(role),
          members: row?.members ?? 0,
          version: row?.version ?? 0,
        };
      }),
    };
  }
}

