import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { DomainEventDispatcher } from '../../../../../shared/infrastructure/events/domain-event-dispatcher.js';
import type { Salon } from '../../../domain/aggregates/salon.js';
import type { SalonRepository } from '../../../domain/repositories/write/salon.repository.js';
import { SalonOrmEntity } from '../orm-entities/salon.orm-entity.js';

@Injectable()
export class TypeOrmSalonRepository implements SalonRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(salon: Salon): Promise<void> {
    const { version: _version, ...row } = salon.snapshot();
    await this.txHost.tx.getRepository(SalonOrmEntity).insert({ ...row, version: 1 });
    await this.events.dispatch(salon.pullEvents());
  }
}
