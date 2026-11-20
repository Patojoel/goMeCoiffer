import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { SalonRoleContract } from '@gomecoiffer/contracts';
import { READ_DB, type SqlReader } from '../../../../../shared/application/ports.js';
import { sql } from '../../../../../shared/application/sql.js';
import { ListSalonTeam } from './list-salon-team.query.js';
import type { SalonTeamReadModel } from './list-salon-team.read-model.js';

interface SalonTeamRow {
  readonly membershipId: string;
  readonly name: string;
  readonly role: SalonRoleContract;
  readonly joinedAt: Date | string;
  readonly isCurrentUser: boolean;
  readonly version: number;
}

/**
 * Équipe active du salon actif (RG-011-02) : Propriétaire en premier puis par nom, sans numéro de téléphone ni
 * membres retirés.
 * Index : index partiel `salon_memberships_salon_active_idx (salon_id) WHERE status = 'ACTIVE'` et clé primaire
 * `users (id)`.
 */
@QueryHandler(ListSalonTeam)
export class ListSalonTeamHandler implements IQueryHandler<ListSalonTeam> {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async execute(q: ListSalonTeam): Promise<SalonTeamReadModel> {
    const rows = await this.db.many<SalonTeamRow>(sql`
      SELECT m.id AS "membershipId",
             COALESCE(u.name, '') AS name,
             m.role,
             m.granted_at AS "joinedAt",
             (m.user_id = ${q.actorUserId}) AS "isCurrentUser",
             m.version
      FROM salon_memberships m
      JOIN users u ON u.id = m.user_id
      WHERE m.salon_id = ${q.salonId}
        AND m.status = 'ACTIVE'
      ORDER BY (m.role = 'OWNER') DESC, LOWER(COALESCE(u.name, '')) ASC, m.id ASC`);

    return {
      members: rows.map((row) => ({
        membershipId: row.membershipId,
        name: row.name,
        role: row.role,
        joinedAt: row.joinedAt instanceof Date ? row.joinedAt.toISOString() : row.joinedAt,
        isCurrentUser: row.isCurrentUser,
        version: row.version,
      })),
    };
  }
}
