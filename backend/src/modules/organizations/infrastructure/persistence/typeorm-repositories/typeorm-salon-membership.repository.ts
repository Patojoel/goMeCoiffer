import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { isPgError } from '../../../../../shared/infrastructure/database/pg-error.js';
import { DomainEventDispatcher } from '../../../../../shared/infrastructure/events/domain-event-dispatcher.js';
import {
  SalonMembership,
  type SalonMembershipStatus,
} from '../../../domain/aggregates/salon-membership.js';
import type { SalonRole } from '../../../domain/enums/salon-role.enum.js';
import { AlreadySalonMemberError } from '../../../domain/exceptions/already-salon-member.error.js';
import { TeamMemberChangedMeanwhileError } from '../../../domain/exceptions/team-member-changed-meanwhile.error.js';
import type { SalonMembershipRepository } from '../../../domain/repositories/write/salon-membership.repository.js';
import { SalonMembershipOrmEntity } from '../orm-entities/salon-membership.orm-entity.js';

const toDomain = (row: SalonMembershipOrmEntity): SalonMembership =>
  SalonMembership.restore({
    id: row.id,
    salonId: row.salonId,
    userId: row.userId,
    role: row.role as SalonRole,
    status: row.status as SalonMembershipStatus,
    grantedAt: row.grantedAt,
    revokedAt: row.revokedAt,
    revokedByUserId: row.revokedByUserId,
    reinstatedAt: row.reinstatedAt,
    version: row.version,
  });

@Injectable()
export class TypeOrmSalonMembershipRepository implements SalonMembershipRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly events: DomainEventDispatcher,
  ) {}

  private get repo() {
    return this.txHost.tx.getRepository(SalonMembershipOrmEntity);
  }

  async add(membership: SalonMembership): Promise<void> {
    const { version: _version, ...row } = membership.snapshot();
    try {
      await this.repo.insert({ ...row, version: 1 });
    } catch (error) {
      // Unicité (salon_id, user_id) : une seule appartenance par compte et par salon, même à deux requêtes.
      if (isPgError(error, '23505')) throw AlreadySalonMemberError.ofInvitee();
      throw error;
    }
    await this.events.dispatch(membership.pullEvents());
  }

  async findByIdInSalon(salonId: string, membershipId: string): Promise<SalonMembership | null> {
    const row = await this.repo.findOneBy({ id: membershipId, salonId });
    return row ? toDomain(row) : null;
  }

  async findBySalonAndUser(salonId: string, userId: string): Promise<SalonMembership | null> {
    const row = await this.repo.findOneBy({ salonId, userId });
    return row ? toDomain(row) : null;
  }

  async save(membership: SalonMembership): Promise<void> {
    const { id, salonId, role, status, revokedAt, revokedByUserId, reinstatedAt, version } =
      membership.snapshot();
    const { affected } = await this.repo
      .createQueryBuilder()
      .update()
      .set({
        role,
        status,
        revokedAt: revokedAt ?? null,
        revokedByUserId: revokedByUserId ?? null,
        reinstatedAt: reinstatedAt ?? null,
        version: () => 'version + 1',
      })
      .where('id = :id AND salon_id = :salonId AND version = :version', {
        id,
        salonId,
        version,
      })
      .execute();
    if (affected === 0) throw new TeamMemberChangedMeanwhileError();
    membership.markPersisted();
    await this.events.dispatch(membership.pullEvents());
  }
}
