import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { READ_DB, type SqlReader } from '../../../../../shared/application/ports.js';
import { sql } from '../../../../../shared/application/sql.js';
import { permissionsOfMember } from '../../../../organizations/domain/services/permissions-of-role.js';
import { nextStepAfterSignIn } from '../../../domain/services/next-step-after-sign-in.js';
import { GetMySession } from './get-my-session.query.js';
import type { SessionSummaryReadModel } from './get-my-session.read-model.js';

interface MembershipRow {
  readonly id: string;
  readonly name: string;
  readonly role: SessionSummaryReadModel['salons'][number]['role'];
  readonly city: SessionSummaryReadModel['salons'][number]['city'];
  readonly district: string;
  readonly ownsOrganization: boolean;
  readonly configuredPermissions: readonly string[] | null;
}

/**
 * Index : clé primaire `users (id)` ; `salon_memberships_user_active_idx` (appartenances actives d'un utilisateur),
 * clés primaires `salons (id)`, `organizations (id)`, `salon_role_permissions (salon_id, role)` et
 * `platform_admin_roles (user_id, role)` (UC-012).
 */
@QueryHandler(GetMySession)
export class GetMySessionHandler implements IQueryHandler<GetMySession> {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async execute(q: GetMySession): Promise<SessionSummaryReadModel> {
    const [user, memberships, platformRoles] = await Promise.all([
      this.db.one<{ id: string; name: string }>(sql`
        SELECT u.id, COALESCE(u.name, '') AS name
        FROM users u
        WHERE u.id = ${q.userId}`),
      this.db.many<MembershipRow>(sql`
        SELECT s.id, s.name, m.role, s.city, s.district,
               o.owner_user_id = m.user_id AS "ownsOrganization",
               r.permissions AS "configuredPermissions"
        FROM salon_memberships m
        JOIN salons s ON s.id = m.salon_id
        JOIN organizations o ON o.id = s.organization_id
        LEFT JOIN salon_role_permissions r
          ON r.salon_id = m.salon_id AND r.role = m.role
        WHERE m.user_id = ${q.userId} AND m.status = 'ACTIVE'
        ORDER BY s.name, s.id`),
      this.db.many<{ role: string }>(sql`
        SELECT role
        FROM platform_admin_roles
        WHERE user_id = ${q.userId}
        ORDER BY granted_at ASC, role ASC`),
    ]);
    const systemRoles = platformRoles.map((r) => r.role);
    const active = q.activeSalonId ? memberships.find((s) => s.id === q.activeSalonId) : undefined;
    const permissions = active
      ? [...permissionsOfMember(active.role, active.ownsOrganization, active.configuredPermissions)]
      : [];

    return {
      user,
      activeSalonId: q.activeSalonId,
      salons: memberships.map(({ id, name, role, city, district }) => ({ id, name, role, city, district })),
      permissions,
      systemRoles,
      nextStep: nextStepAfterSignIn({ systemRoles, salonIds: memberships.map((s) => s.id) }),
    };
  }
}
