import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { ConcurrencyConflictError, ConflictError } from '../../../../shared/domain/errors.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { isPgError } from '../../../../shared/infrastructure/database/pg-error.js';
import { OtpChallenge, type OtpPurpose } from '../../domain/otp-challenge.js';
import type { CodeSend } from '../../domain/otp-sending-policy.js';
import type { OtpChallengeRepository } from '../../domain/ports.js';
import { OtpChallengeOrmEntity } from './otp-challenge.orm-entity.js';

@Injectable()
export class TypeOrmOtpChallengeRepository implements OtpChallengeRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  private get repo() {
    return this.txHost.tx.getRepository(OtpChallengeOrmEntity);
  }

  async findActive(phone: PhoneNumber, purpose: OtpPurpose): Promise<OtpChallenge | null> {
    const row = await this.repo.findOneBy({ phone: phone.value, purpose, status: 'ACTIVE' });
    return row ? OtpChallenge.restore(row) : null;
  }

  /** Verrou consultatif PostgreSQL libéré au commit ou à l'annulation de la transaction en cours. */
  async lockSendingFor(phone: PhoneNumber): Promise<void> {
    await this.txHost.tx.query(`SELECT pg_advisory_xact_lock(hashtext('otp:' || $1))`, [phone.value]);
  }

  async recentSends(phone: PhoneNumber, purpose: OtpPurpose, since: Date): Promise<readonly CodeSend[]> {
    const rows = await this.repo
      .createQueryBuilder('c')
      .select('c.sent_at', 'sentAt')
      .addSelect(`CASE WHEN c.status = 'CONSUMED' THEN c.attempts - 1 ELSE c.attempts END`, 'failedAttempts')
      .where('c.phone = :phone AND c.purpose = :purpose AND c.sent_at > :since', {
        phone: phone.value,
        purpose,
        since,
      })
      .getRawMany<{ sentAt: Date; failedAttempts: number }>();
    return rows.map((r) => ({ sentAt: r.sentAt, failedAttempts: Number(r.failedAttempts) }));
  }

  async save(challenge: OtpChallenge): Promise<void> {
    const { version, ...row } = challenge.snapshot();
    try {
      if (version === 0) {
        await this.repo.insert({ ...row, version: 1 });
        return;
      }
      const { affected } = await this.repo
        .createQueryBuilder()
        .update()
        .set({ ...row, version: () => 'version + 1' })
        .where('id = :id AND version = :version', { id: row.id, version })
        .execute();
      if (affected === 0) throw new ConcurrencyConflictError('OtpChallenge', row.id);
    } catch (error) {
      // Index unique partiel : un seul code actif par numéro et par motif (deux demandes simultanées).
      if (isPgError(error, '23505'))
        throw new ConflictError("Un code vient d'être envoyé à ce numéro. Réessayez.");
      throw error;
    }
  }
}
