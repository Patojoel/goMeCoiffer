import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { READ_DB, type SqlReader } from '../../../../../shared/application/ports.js';
import { sql } from '../../../../../shared/application/sql.js';
import { InvalidValueError } from '../../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { SystemRole } from '../../../domain/enums/system-role.enum.js';
import { ListPlatformAdmins } from './list-platform-admins.query.js';
import type { ListPlatformAdminsReadModel } from './list-platform-admins.read-model.js';

const UNREADABLE_PHONE = '•• •• •• ••';

/** Un numéro mal formé en base ne doit pas faire échouer toute la liste : il est caché en entier. */
const maskedPhoneOf = (raw: string): string => {
  try {
    return PhoneNumber.parse(raw).maskedToEnds();
  } catch (error) {
    if (error instanceof InvalidValueError) return UNREADABLE_PHONE;
    throw error;
  }
};

interface PlatformAdminRoleRow {
  readonly userId: string;
  readonly name: string;
  readonly phone: string;
  readonly role: SystemRole;
  readonly grantedAt: Date | string;
}

/**
 * Liste des administrateurs GoMeCoiffer avec téléphone masqué (RG-012-10, EX-025).
 * Index : `platform_admin_roles` PK `(user_id, role)` et `users` PK `(id)`.
 */
@QueryHandler(ListPlatformAdmins)
export class ListPlatformAdminsHandler implements IQueryHandler<ListPlatformAdmins> {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async execute(_query: ListPlatformAdmins): Promise<ListPlatformAdminsReadModel> {
    const rows = await this.db.many<PlatformAdminRoleRow>(sql`
      SELECT
        r.user_id AS "userId",
        COALESCE(u.name, '') AS "name",
        u.phone AS "phone",
        r.role AS "role",
        r.granted_at AS "grantedAt"
      FROM platform_admin_roles r
      JOIN users u ON u.id = r.user_id
      ORDER BY COALESCE(u.name, '') ASC, r.granted_at ASC, r.role ASC
    `);

    const byUser = new Map<
      string,
      {
        userId: string;
        name: string;
        maskedPhone: string;
        roles: { role: SystemRole; grantedAt: string }[];
      }
    >();
    let superAdminCount = 0;

    for (const row of rows) {
      if (row.role === SystemRole.SUPER_ADMIN) superAdminCount += 1;
      const grantedAt =
        row.grantedAt instanceof Date ? row.grantedAt.toISOString() : new Date(row.grantedAt).toISOString();
      const existing = byUser.get(row.userId);
      if (existing) {
        existing.roles.push({ role: row.role, grantedAt });
      } else {
        byUser.set(row.userId, {
          userId: row.userId,
          name: row.name,
          maskedPhone: maskedPhoneOf(row.phone),
          roles: [{ role: row.role, grantedAt }],
        });
      }
    }

    return {
      superAdminCount,
      admins: [...byUser.values()],
    };
  }
}

