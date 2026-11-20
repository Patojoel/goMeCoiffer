import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { isPgError } from '../../../../../shared/infrastructure/database/pg-error.js';
import { DomainEventDispatcher } from '../../../../../shared/infrastructure/events/domain-event-dispatcher.js';
import type { SalonMembership } from '../../../domain/aggregates/salon-membership.js';
import { AlreadySalonMemberError } from '../../../domain/exceptions/already-salon-member.error.js';
import type { SalonMembershipRepository } from '../../../domain/repositories/write/salon-membership.repository.js';
import { SalonMembershipOrmEntity } from '../orm-entities/salon-membership.orm-entity.js';

@Injectable()
export class TypeOrmSalonMembershipRepository implements SalonMembershipRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(membership: SalonMembership): Promise<void> {
    const { version: _version, ...row } = membership.snapshot();
    try {
      await this.txHost.tx.getRepository(SalonMembershipOrmEntity).insert({ ...row, version: 1 });
    } catch (error) {
      // Unicité (salon_id, user_id) : une seule appartenance par compte et par salon, même à deux requêtes.
      if (isPgError(error, '23505')) throw AlreadySalonMemberError.ofInvitee();
      throw error;
    }
    await this.events.dispatch(membership.pullEvents());
  }
}
