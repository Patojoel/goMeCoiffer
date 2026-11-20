import { Inject, Injectable } from '@nestjs/common';
import { READ_DB, type SqlReader } from '../../../../shared/application/ports.js';
import { sql } from '../../../../shared/application/sql.js';
import type { InvitableSalonRole } from '../../domain/enums/invitable-salon-role.enum.js';
import type { SalonRolePermissions } from '../../domain/repositories/read/salon-role-permissions.read-repository.js';

/**
 * Source unique des permissions d'un rôle dans un salon (RG-008-12).
 * Index : clé primaire `salon_role_permissions (salon_id, role)`.
 */
@Injectable()
export class SqlSalonRolePermissions implements SalonRolePermissions {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async permissionsOfRoleInSalon(
    salonId: string,
    role: InvitableSalonRole,
  ): Promise<readonly string[] | null> {
    const row = await this.db.maybeOne<{ permissions: readonly string[] }>(sql`
      SELECT permissions
      FROM salon_role_permissions
      WHERE salon_id = ${salonId} AND role = ${role}`);
    return row ? [...row.permissions] : null;
  }
}

