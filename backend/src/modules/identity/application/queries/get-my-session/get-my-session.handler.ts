import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { READ_DB, type SqlReader } from '../../../../../shared/application/ports.js';
import { sql } from '../../../../../shared/application/sql.js';
import { nextStepAfterSignIn } from '../../../domain/services/next-step-after-sign-in.js';
import { GetMySession } from './get-my-session.query.js';
import type { SessionSummaryReadModel } from './get-my-session.read-model.js';

/**
 * Index : clé primaire `users (id)` ; `salon_memberships_user_active_idx` (appartenances actives d'un utilisateur)
 * puis clé primaire `salons (id)`. Les rôles système (UC-008) s'ajouteront ici, sans toucher à la règle de l'étape
 * suivante.
 */
@QueryHandler(GetMySession)
export class GetMySessionHandler implements IQueryHandler<GetMySession> {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async execute(q: GetMySession): Promise<SessionSummaryReadModel> {
    const [user, salons] = await Promise.all([
      this.db.one<{ id: string; name: string }>(sql`
        SELECT u.id, COALESCE(u.name, '') AS name
        FROM users u
        WHERE u.id = ${q.userId}`),
      this.db.many<SessionSummaryReadModel['salons'][number]>(sql`
        SELECT s.id, s.name, m.role, s.city, s.district
        FROM salon_memberships m
        JOIN salons s ON s.id = m.salon_id
        WHERE m.user_id = ${q.userId} AND m.status = 'ACTIVE'
        ORDER BY s.name, s.id`),
    ]);
    // Rôles système : table pas encore créée (UC-008).
    const systemRoles: string[] = [];

    return {
      user,
      activeSalonId: q.activeSalonId,
      salons: [...salons],
      systemRoles,
      nextStep: nextStepAfterSignIn({ systemRoles, salonIds: salons.map((s) => s.id) }),
    };
  }
}
