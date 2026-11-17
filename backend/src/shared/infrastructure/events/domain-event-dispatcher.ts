import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { AfterCommit } from '../../application/after-commit.js';
import { ID_GENERATOR, type IdGenerator } from '../../application/ports.js';
import {
  type DomainEvent,
  type IntegrationEventClass,
  isIntegrationEvent,
} from '../../domain/domain-event.js';
import { EventSubscriberRegistry } from './event-subscriber.registry.js';
import { OutboxRelay } from './outbox-relay.js';

/**
 * Appelé par les repositories après la sauvegarde d'un agrégat, dans la transaction de la commande :
 * DomainEvent → subscribers synchrones (un échec annule tout) ; IntegrationEvent → ligne d'outbox.
 */
@Injectable()
export class DomainEventDispatcher {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly registry: EventSubscriberRegistry,
    private readonly afterCommit: AfterCommit,
    private readonly relay: OutboxRelay,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  async dispatch(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      if (isIntegrationEvent(event)) await this.enqueue(event);
      else
        for (const subscriber of this.registry.subscribersOf(event.constructor))
          await subscriber.handle(event);
    }
  }

  private async enqueue(event: DomainEvent): Promise<void> {
    const { type } = event.constructor as IntegrationEventClass;
    await this.txHost.tx.query(
      `INSERT INTO outbox (id, type, payload, occurred_at) VALUES ($1, $2, $3, $4)`,
      [this.ids.next(), type, JSON.stringify(event), event.occurredAt],
    );
    this.afterCommit.register(() => this.relay.wake());
  }
}
