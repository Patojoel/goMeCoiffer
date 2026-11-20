import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock, READ_DB, type SqlReader } from '../../../../../shared/application/ports.js';
import { sql } from '../../../../../shared/application/sql.js';
import { PhoneProofRequiredError } from '../../../domain/exceptions/phone-proof-required.error.js';
import { PHONE_PROOFS, type PhoneProofs } from '../../../domain/ports/phone-proofs.port.js';
import { ListInvitationsForProvenPhone } from './list-invitations-for-proven-phone.query.js';
import type { InvitationsForProvenPhoneReadModel } from './list-invitations-for-proven-phone.read-model.js';

/** Au plus 50 invitations en attente par numéro (D-044) : la borne ne coupe rien, elle protège la requête. */
const MAX_LISTED = 50;

type Invitations = InvitationsForProvenPhoneReadModel['invitations'];

/**
 * Index : `salon_invitations_pending_phone_idx (phone, sent_at DESC) WHERE status = 'PENDING'` sert le filtre de
 * numéro et le tri ; `salons` et `users` se lisent par clé (`id`, `users_phone_key`).
 */
@QueryHandler(ListInvitationsForProvenPhone)
export class ListInvitationsForProvenPhoneHandler implements IQueryHandler<ListInvitationsForProvenPhone> {
  constructor(
    @Inject(PHONE_PROOFS) private readonly proofs: PhoneProofs,
    @Inject(READ_DB) private readonly db: SqlReader,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(q: ListInvitationsForProvenPhone): Promise<InvitationsForProvenPhoneReadModel> {
    const now = this.clock.now();
    const proof = await this.proofs.phoneProvenBy(q.proofToken, now);
    if (!proof) throw new PhoneProofRequiredError();
    const phone = proof.phone.value;

    const [invitations, account] = await Promise.all([
      this.db.many<Invitations[number]>(sql`
        WITH pending AS (
          SELECT i.id, i.salon_id, i.name, i.role, i.sent_at, i.expires_at
          FROM salon_invitations i
          WHERE i.phone = ${phone}
            AND i.status = 'PENDING'
            AND i.expires_at > ${now}::timestamptz
          ORDER BY i.sent_at DESC
          LIMIT ${MAX_LISTED}
        )
        SELECT p.id AS "invitationId", s.name AS "salonName", s.city, s.district, p.role,
               to_char(p.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "expiresAt",
               p.name AS "suggestedName"
        FROM pending p
        JOIN salons s ON s.id = p.salon_id
        ORDER BY p.sent_at DESC`),
      this.db.maybeOne<{ staff: boolean }>(sql`
        SELECT (u.password_hash IS NOT NULL) AS "staff" FROM users u WHERE u.phone = ${phone}`),
    ]);
    return { account: account === null ? 'NEW' : account.staff ? 'EXISTING' : 'TO_COMPLETE', invitations };
  }
}
