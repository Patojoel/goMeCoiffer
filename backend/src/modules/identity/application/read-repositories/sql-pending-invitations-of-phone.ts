import { Inject, Injectable } from '@nestjs/common';
import { READ_DB, type SqlReader } from '../../../../shared/application/ports.js';
import { sql } from '../../../../shared/application/sql.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { PendingInvitationsOfPhone } from '../../domain/repositories/read/pending-invitations-of-phone.read-repository.js';

/** Index : `salon_invitations_pending_phone_idx (phone, sent_at DESC) WHERE status = 'PENDING'`. */
@Injectable()
export class SqlPendingInvitationsOfPhone implements PendingInvitationsOfPhone {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async existsFor(phone: PhoneNumber, now: Date): Promise<boolean> {
    const row = await this.db.one<{ found: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1
        FROM salon_invitations
        WHERE phone = ${phone.value} AND status = 'PENDING' AND expires_at > ${now}::timestamptz
      ) AS "found"`);
    return row.found;
  }
}
