import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import {
  type DomainEventSubscriber,
  isDomainEventSubscriber,
} from '../../application/domain-event-subscriber.js';
import type { IntegrationEventClass } from '../../domain/domain-event.js';

/** Découvre au démarrage tous les providers abonnés à un événement (pas d'enregistrement manuel). */
@Injectable()
export class EventSubscriberRegistry implements OnApplicationBootstrap {
  private byClass = new Map<Function, DomainEventSubscriber[]>();
  private byIntegrationType = new Map<
    string,
    { eventClass: IntegrationEventClass; subscribers: DomainEventSubscriber[] }
  >();

  constructor(private readonly discovery: DiscoveryService) {}

  onApplicationBootstrap(): void {
    const subscribers = this.discovery
      .getProviders()
      // Seules les classes avec une méthode `handle` : les providers proxy (nestjs-cls) jettent à la lecture.
      .filter((wrapper) => typeof (wrapper.metatype as Function | null)?.prototype?.handle === 'function')
      .map((wrapper) => wrapper.instance as unknown)
      .filter(isDomainEventSubscriber);
    for (const subscriber of subscribers) {
      const eventClass = subscriber.subscribesTo;
      this.byClass.set(eventClass, [...(this.byClass.get(eventClass) ?? []), subscriber]);
      const type = (eventClass as Partial<IntegrationEventClass>).type;
      if (typeof type === 'string') {
        const entry = this.byIntegrationType.get(type) ?? {
          eventClass: eventClass as IntegrationEventClass,
          subscribers: [],
        };
        entry.subscribers.push(subscriber);
        this.byIntegrationType.set(type, entry);
      }
    }
  }

  subscribersOf(eventClass: Function): readonly DomainEventSubscriber[] {
    return this.byClass.get(eventClass) ?? [];
  }

  integrationSubscribers(type: string) {
    return this.byIntegrationType.get(type);
  }
}
