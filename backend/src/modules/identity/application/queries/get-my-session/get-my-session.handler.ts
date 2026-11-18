import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { READ_DB, type SqlReader } from '../../../../../shared/application/ports.js';
import { sql } from '../../../../../shared/application/sql.js';
import { nextStepAfterSignIn } from '../../../domain/services/next-step-after-sign-in.js';
import { GetMySession } from './get-my-session.query.js';
import type { SessionSalon, SessionSummaryReadModel } from './get-my-session.read-model.js';

/**
 * Index utilisé : clé primaire `users (id)`.
 * Les appartenances (UC-004/005) et rôles système (UC-008) s'ajoutent ici en deux lectures filtrées par
 * `${q.userId}`, sans toucher à la règle de l'étape suivante.
 */
@QueryHandler(GetMySession)
export class GetMySessionHandler implements IQueryHandler<GetMySession> {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async execute(q: GetMySession): Promise<SessionSummaryReadModel | null> {
    const user = await this.db.maybeOne<{ id: string; name: string }>(sql`
      SELECT u.id, COALESCE(u.name, '') AS name
      FROM users u
      WHERE u.id = ${q.userId}`);
    if (!user) return null;

    // Tables d'appartenances et de rôles système pas encore créées : aucune donnée à lire.
    const salons: readonly SessionSalon[] = [];
    const systemRoles: readonly string[] = [];

    return {
      user,
      activeSalonId: q.activeSalonId,
      salons,
      systemRoles,
      nextStep: nextStepAfterSignIn({ systemRoles, salonIds: salons.map((s) => s.id) }),
    };
  }
}
