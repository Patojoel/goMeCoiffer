import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { isPgError } from '../../../../../shared/infrastructure/database/pg-error.js';
import { DomainEventDispatcher } from '../../../../../shared/infrastructure/events/domain-event-dispatcher.js';
import type { Salon } from '../../../domain/aggregates/salon.js';
import { SalonNameAlreadyExistsError } from '../../../domain/exceptions/salon-name-already-exists.error.js';
import type { SalonRepository } from '../../../domain/repositories/write/salon.repository.js';
import { SalonOrmEntity } from '../orm-entities/salon.orm-entity.js';

const UNIQUE_NAME_INDEX = 'salons_organization_lower_name_key';

const isDuplicateSalonName = (error: unknown): boolean => {
  if (!isPgError(error, '23505')) return false;
  const e = error as { constraint?: string; driverError?: { constraint?: string } } | null;
  return (e?.constraint ?? e?.driverError?.constraint) === UNIQUE_NAME_INDEX;
};

@Injectable()
export class TypeOrmSalonRepository implements SalonRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly events: DomainEventDispatcher,
  ) {}

  private get repo() {
    return this.txHost.tx.getRepository(SalonOrmEntity);
  }

  async add(salon: Salon): Promise<void> {
    const { version: _version, ...row } = salon.snapshot();
    try {
      await this.repo.insert({ ...row, version: 1 });
    } catch (error) {
      if (isDuplicateSalonName(error)) throw new SalonNameAlreadyExistsError();
      throw error;
    }
    await this.events.dispatch(salon.pullEvents());
  }

  async existsWithNameInOrganization(organizationId: string, name: string): Promise<boolean> {
    const count = await this.repo
      .createQueryBuilder('s')
      .where('s.organization_id = :organizationId', { organizationId })
      .andWhere('LOWER(s.name) = LOWER(:name)', { name })
      .getCount();
    return count > 0;
  }
}
