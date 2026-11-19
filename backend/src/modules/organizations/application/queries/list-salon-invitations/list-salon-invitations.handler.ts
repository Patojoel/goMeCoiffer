import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock, READ_DB, type SqlReader } from '../../../../../shared/application/ports.js';
import { sql } from '../../../../../shared/application/sql.js';
import { ListSalonInvitations } from './list-salon-invitations.query.js';
import type { SalonInvitationReadModel } from './list-salon-invitations.read-model.js';

/**
 * Borne de la liste. Les « en attente » sont au plus 50 (D-044) et, la validité étant fixe (7 jours), ce sont
 * toujours les plus récentes : le tri `sent_at DESC` les garde toutes. Les expirées sont bornées par l'effacement
 * du nom à J+30 (elles sortent alors de la liste) et par 20 envois par 24 h ; 100 lignes couvrent l'écran.
 */
const MAX_LISTED = 100;

/**
 * Index : `salon_invitations_salon_sent_idx (salon_id, sent_at DESC)` sert le filtre de salon et le tri, sans tri
 * séparé ; le filtre de statut et de nom se fait sur les lignes du salon.
 */
@QueryHandler(ListSalonInvitations)
export class ListSalonInvitationsHandler implements IQueryHandler<ListSalonInvitations> {
  constructor(
    @Inject(READ_DB) private readonly db: SqlReader,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  execute(q: ListSalonInvitations): Promise<readonly SalonInvitationReadModel[]> {
    const now = this.clock.now();
    return this.db.many<SalonInvitationReadModel>(sql`
      WITH salon_invitations_listed AS (
        SELECT i.id, i.name, i.phone, i.role, i.sent_at, i.expires_at, i.status
        FROM salon_invitations i
        WHERE i.salon_id = ${q.salonId}
          AND i.status IN ('PENDING', 'EXPIRED')
          AND i.name IS NOT NULL
        ORDER BY i.sent_at DESC
        LIMIT ${MAX_LISTED}
      )
      SELECT l.id, l.name, l.phone, l.role,
             to_char(l.sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "sentAt",
             to_char(l.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "expiresAt",
             CASE WHEN l.status = 'PENDING' AND l.expires_at > ${now}::timestamptz THEN 'PENDING' ELSE 'EXPIRED' END AS status
      FROM salon_invitations_listed l
      ORDER BY l.sent_at DESC`);
  }
}
