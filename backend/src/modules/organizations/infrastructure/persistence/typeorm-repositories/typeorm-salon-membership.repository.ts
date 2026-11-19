import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { DomainEventDispatcher } from '../../../../../shared/infrastructure/events/domain-event-dispatcher.js';
import type { SalonMembership } from '../../../domain/aggregates/salon-membership.js';
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
    await this.txHost.tx.getRepository(SalonMembershipOrmEntity).insert({ ...row, version: 1 });
    await this.events.dispatch(membership.pullEvents());
  }
}
