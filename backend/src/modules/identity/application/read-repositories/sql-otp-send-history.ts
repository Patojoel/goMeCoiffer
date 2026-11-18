import { Inject, Injectable } from '@nestjs/common';
import { READ_DB, type SqlReader } from '../../../../shared/application/ports.js';
import { sql } from '../../../../shared/application/sql.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { OtpPurpose } from '../../domain/enums/otp-purpose.enum.js';
import type { OtpSendHistory } from '../../domain/repositories/read/otp-send-history.read-repository.js';
import type { CodeSend } from '../../domain/value-objects/code-send.js';

/**
 * Lue dans la transaction de la demande de code, après le verrou par numéro : elle voit les envois que les
 * demandes précédentes ont commités. Index utilisé : `otp_challenges (phone, sent_at DESC)`.
 */
@Injectable()
export class SqlOtpSendHistory implements OtpSendHistory {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async recentSends(phone: PhoneNumber, purpose: OtpPurpose, since: Date): Promise<readonly CodeSend[]> {
    const rows = await this.db.many<{ sentAt: Date; failedAttempts: number }>(sql`
      SELECT c.sent_at AS "sentAt",
             CASE WHEN c.status = 'CONSUMED' THEN c.attempts - 1 ELSE c.attempts END AS "failedAttempts"
      FROM otp_challenges c
      WHERE c.phone = ${phone.value}
        AND c.purpose = ${purpose}
        AND c.sent_at > ${since}`);
    return rows.map((r) => ({ sentAt: r.sentAt, failedAttempts: Number(r.failedAttempts) }));
  }
}
