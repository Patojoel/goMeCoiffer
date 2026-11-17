import type { DomainEvent, IntegrationEventClass } from '../domain/domain-event.js';

type EventClass<E extends DomainEvent> = abstract new (...args: never[]) => E;

/**
 * Réaction à un événement : un provider @Injectable découvert au démarrage par `subscribesTo`.
 * Il reçoit le handler cible injecté et lui délègue, sans logique métier.
 */
export interface DomainEventSubscriber<E extends DomainEvent = DomainEvent> {
  readonly subscribesTo: EventClass<E> | IntegrationEventClass;
  handle(event: E): Promise<unknown> | unknown;
}

export function isDomainEventSubscriber(candidate: unknown): candidate is DomainEventSubscriber {
  const c = candidate as Partial<DomainEventSubscriber> | null;
  return typeof c?.subscribesTo === 'function' && typeof c.handle === 'function';
}
