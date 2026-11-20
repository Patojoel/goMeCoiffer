import { Inject, Injectable } from '@nestjs/common';
import { type ActorRights, READ_DB, type SqlReader } from '../../../../shared/application/ports.js';
import { sql } from '../../../../shared/application/sql.js';
import { permissionsOfMember } from '../../domain/services/permissions-of-role.js';

/**
 * Droits relus à chaque requête (D-037, RG-008-10, RG-012-08) : appartenance ACTIVE au salon actif, permissions
 * configurées du rôle dans ce salon, rôles système actifs (`platform_admin_roles`), version des identifiants du compte.
 * Un rôle système n'est jamais déduit d'un rôle salon, et un rôle salon n'est jamais déduit d'un rôle système.
 * Index : clé primaire `users (id)`, unicité `salon_memberships (salon_id, user_id)`, clé primaire
 * `salon_role_permissions (salon_id, role)`, clé primaire `platform_admin_roles (user_id, role)`.
 */
@Injectable()
export class SqlActorRights implements ActorRights {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async resolve(userId: string, activeSalonId: string | null) {
    const [account, platformRoles] = await Promise.all([
      this.db.maybeOne<{
        credentialsVersion: number;
        role: string | null;
        ownsOrganization: boolean;
        configuredPermissions: readonly string[] | null;
      }>(sql`
        SELECT u.credentials_version AS "credentialsVersion", m.role AS "role",
               o.owner_user_id = u.id AS "ownsOrganization",
               r.permissions AS "configuredPermissions"
        FROM users u
        LEFT JOIN salon_memberships m
          ON m.user_id = u.id AND m.salon_id = ${activeSalonId}::uuid AND m.status = 'ACTIVE'
        LEFT JOIN salons s ON s.id = m.salon_id
        LEFT JOIN organizations o ON o.id = s.organization_id
        LEFT JOIN salon_role_permissions r
          ON r.salon_id = m.salon_id AND r.role = m.role
        WHERE u.id = ${userId}`),
      this.db.many<{ role: string }>(sql`
        SELECT role
        FROM platform_admin_roles
        WHERE user_id = ${userId}`),
    ]);
    return {
      isMember: account?.role != null,
      permissions: permissionsOfMember(
        account?.role ?? null,
        account?.ownsOrganization ?? false,
        account?.configuredPermissions ?? null,
      ),
      systemRoles: platformRoles.map((r) => r.role),
      credentialsVersion: account?.credentialsVersion ?? null,
    };
  }
}
