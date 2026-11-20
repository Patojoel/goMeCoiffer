import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { ConcurrencyConflictError } from '../../../../../shared/domain/errors.js';
import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { isPgError } from '../../../../../shared/infrastructure/database/pg-error.js';
import { DomainEventDispatcher } from '../../../../../shared/infrastructure/events/domain-event-dispatcher.js';
import { Invitation } from '../../../domain/aggregates/invitation.js';
import type { InvitationStatus } from '../../../domain/enums/invitation-status.enum.js';
import type { SalonRole } from '../../../domain/enums/salon-role.enum.js';
import { InvitationAlreadyPendingError } from '../../../domain/exceptions/invitation-already-pending.error.js';
import { InvitationNotFoundError } from '../../../domain/exceptions/invitation-not-found.error.js';
import type { InvitationRepository } from '../../../domain/repositories/write/invitation.repository.js';
import { InvitationOrmEntity } from '../orm-entities/invitation.orm-entity.js';

const toDomain = (row: InvitationOrmEntity): Invitation =>
  Invitation.restore({
    ...row,
    role: row.role as SalonRole,
    status: row.status as InvitationStatus,
  });

@Injectable()
export class TypeOrmInvitationRepository implements InvitationRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly events: DomainEventDispatcher,
  ) {}

  private get repo() {
    return this.txHost.tx.getRepository(InvitationOrmEntity);
  }

  async add(invitation: Invitation): Promise<void> {
    const { version: _version, ...row } = invitation.snapshot();
    try {
      await this.repo.insert({ ...row, version: 1 });
    } catch (error) {
      // Index unique partiel (salon_id, phone) WHERE status = 'PENDING' : garantie même à deux requêtes (RG-006-08).
      if (isPgError(error, '23505')) throw new InvitationAlreadyPendingError();
      throw error;
    }
    await this.events.dispatch(invitation.pullEvents());
  }

  async save(invitation: Invitation): Promise<void> {
    const { id, status, endedAt, name, phone, acceptedByUserId, version } = invitation.snapshot();
    const { affected } = await this.repo
      .createQueryBuilder()
      .update()
      .set({ status, endedAt, name, phone, acceptedByUserId, version: () => 'version + 1' })
      .where('id = :id AND version = :version', { id, version })
      .execute();
    if (affected === 0) throw new ConcurrencyConflictError('Invitation', id);
    await this.events.dispatch(invitation.pullEvents());
  }

  async getOfSalon(salonId: string, id: string): Promise<Invitation> {
    const row = await this.repo.findOneBy({ id, salonId });
    if (!row) throw new InvitationNotFoundError();
    return toDomain(row);
  }

  async getOfInvitee(phone: PhoneNumber, id: string): Promise<Invitation> {
    const row = await this.repo
      .createQueryBuilder('i')
      .where('i.id = :id', { id })
      .andWhere(
        new Brackets((byPhone) =>
          byPhone
            .where('i.phone = :phone', { phone: phone.value })
            .orWhere('i.acceptedByUserId = (SELECT u.id FROM users u WHERE u.phone = :phone)'),
        ),
      )
      .getOne();
    if (!row) throw new InvitationNotFoundError();
    return toDomain(row);
  }

  async findPendingOfPhone(salonId: string, phone: PhoneNumber): Promise<Invitation | null> {
    const row = await this.repo.findOneBy({ salonId, phone: phone.value, status: 'PENDING' });
    return row ? toDomain(row) : null;
  }

  async purgePersonalDataEndedBefore(before: Date): Promise<number> {
    const { affected } = await this.repo
      .createQueryBuilder()
      .update()
      .set({
        name: null,
        phone: null,
        status: () => `CASE WHEN status = 'PENDING' THEN 'EXPIRED' ELSE status END`,
        endedAt: () => 'COALESCE(ended_at, expires_at)',
        version: () => 'version + 1',
      })
      .where(`status <> 'ACCEPTED' AND name IS NOT NULL AND COALESCE(ended_at, expires_at) <= :before`, {
        before,
      })
      .execute();
    return affected ?? 0;
  }
}
