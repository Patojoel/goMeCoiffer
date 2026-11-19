import { Inject, Injectable } from '@nestjs/common';
import { type ActorRights, READ_DB, type SqlReader } from '../../../../shared/application/ports.js';
import { sql } from '../../../../shared/application/sql.js';
import { permissionsOfRole } from '../../domain/services/permissions-of-role.js';

/**
 * Droits relus à chaque requête (D-037) : appartenance ACTIVE au salon actif, permissions de son rôle, version des
 * identifiants du compte. Rôles système vides jusqu'à UC-008 : un rôle système n'est jamais déduit d'un rôle salon.
 * Droits protégés : seulement si l'utilisateur possède l'organisation du salon. Index : clé primaire `users (id)` puis unicité `salon_memberships (salon_id, user_id)`.
 */
@Injectable()
export class SqlActorRights implements ActorRights {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async resolve(userId: string, activeSalonId: string | null) {
    const account = await this.db.maybeOne<{
      credentialsVersion: number;
      role: string | null;
      ownsOrganization: boolean;
    }>(sql`
      SELECT u.credentials_version AS "credentialsVersion", m.role AS "role",
             o.owner_user_id = u.id AS "ownsOrganization"
      FROM users u
      LEFT JOIN salon_memberships m
        ON m.user_id = u.id AND m.salon_id = ${activeSalonId}::uuid AND m.status = 'ACTIVE'
      LEFT JOIN salons s ON s.id = m.salon_id
      LEFT JOIN organizations o ON o.id = s.organization_id
      WHERE u.id = ${userId}`);
    return {
      isMember: account?.role != null,
      permissions: permissionsOfRole(account?.role ?? null, account?.ownsOrganization ?? false),
      systemRoles: [],
      credentialsVersion: account?.credentialsVersion ?? null,
    };
  }
}
