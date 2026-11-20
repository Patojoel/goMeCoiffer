import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { isPgError } from '../../../../../shared/infrastructure/database/pg-error.js';
import { DomainEventDispatcher } from '../../../../../shared/infrastructure/events/domain-event-dispatcher.js';
import { Organization } from '../../../domain/aggregates/organization.js';
import { OrganizationAlreadyExistsError } from '../../../domain/exceptions/organization-already-exists.error.js';
import type { OrganizationRepository } from '../../../domain/repositories/write/organization.repository.js';
import { OrganizationOrmEntity } from '../orm-entities/organization.orm-entity.js';

@Injectable()
export class TypeOrmOrganizationRepository implements OrganizationRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(organization: Organization): Promise<void> {
    const { version: _version, ...row } = organization.snapshot();
    try {
      await this.txHost.tx.getRepository(OrganizationOrmEntity).insert({ ...row, version: 1 });
    } catch (error) {
      // Unicité de `owner_user_id` : la garantie « une organisation par utilisateur » (D-035), même à deux requêtes.
      if (isPgError(error, '23505')) throw new OrganizationAlreadyExistsError();
      throw error;
    }
    await this.events.dispatch(organization.pullEvents());
  }

  async findByOwner(ownerUserId: string): Promise<Organization | null> {
    const row = await this.txHost.tx.getRepository(OrganizationOrmEntity).findOneBy({ ownerUserId });
    return row ? Organization.restore(row) : null;
  }
}
