import { Inject, Injectable } from '@nestjs/common';
import { READ_DB, type SqlReader } from '../../../../shared/application/ports.js';
import { sql } from '../../../../shared/application/sql.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { InvitationChecks } from '../../domain/repositories/read/invitation-checks.read-repository.js';

/**
 * Index : unicité `users (phone)` puis `salon_memberships (salon_id, user_id)` ; `salon_invitations (salon_id, sent_at)`
 * pour le compteur du salon ; index partiel `(phone, sent_at)` pour la limite par numéro ; clé primaire `salons (id)`.
 */
@Injectable()
export class SqlInvitationChecks implements InvitationChecks {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async lockSalon(salonId: string): Promise<void> {
    const key = `salon:${salonId}`;
    await this.db.one(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async lockPhone(phone: PhoneNumber): Promise<void> {
    const key = `phone:${phone.value}`;
    await this.db.one(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }

  async isActiveMember(salonId: string, phone: PhoneNumber): Promise<boolean> {
    const row = await this.db.one<{ isMember: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1
        FROM users u
        JOIN salon_memberships m ON m.user_id = u.id
        WHERE u.phone = ${phone.value} AND m.salon_id = ${salonId} AND m.status = 'ACTIVE'
      ) AS "isMember"`);
    return row.isMember;
  }

  async invitationsSentSince(salonId: string, since: Date): Promise<number> {
    const row = await this.db.one<{ total: number }>(sql`
      SELECT count(*)::int AS "total"
      FROM salon_invitations
      WHERE salon_id = ${salonId} AND sent_at >= ${since}::timestamptz`);
    return row.total;
  }

  async pendingCount(salonId: string, now: Date): Promise<number> {
    const row = await this.db.one<{ total: number }>(sql`
      SELECT count(*)::int AS "total"
      FROM salon_invitations
      WHERE salon_id = ${salonId} AND status = 'PENDING' AND expires_at > ${now}::timestamptz`);
    return row.total;
  }

  async textMessagesSentSince(phone: PhoneNumber, since: Date): Promise<number> {
    const row = await this.db.one<{ total: number }>(sql`
      SELECT count(DISTINCT salon_id)::int AS "total"
      FROM salon_invitations
      WHERE phone = ${phone.value} AND notified_by_sms AND sent_at >= ${since}::timestamptz`);
    return row.total;
  }

  salonOf(salonId: string) {
    return this.db.one<{ readonly timezone: string }>(sql`
      SELECT timezone FROM salons WHERE id = ${salonId}`);
  }
}
