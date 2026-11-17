/** Fait métier au passé, dispatché de façon synchrone dans la transaction de la commande. */
export interface DomainEvent {
  readonly occurredAt: Date;
}

/**
 * Fait publié après commit via l'outbox, livré au moins une fois. `type` (statique) est un contrat :
 * clé de routage stockée dans l'outbox, il ne se renomme jamais. Hors `occurredAt`, la charge ne porte
 * que des valeurs JSON (identifiants, statuts, chaînes ISO) : elle est sérialisée dans l'outbox.
 */
export interface IntegrationEvent extends DomainEvent {
  readonly integration: true;
}

export interface IntegrationEventClass<E extends IntegrationEvent = IntegrationEvent> {
  readonly type: string;
  new (...args: never[]): E;
}

export function isIntegrationEvent(event: DomainEvent): event is IntegrationEvent {
  return (event as Partial<IntegrationEvent>).integration === true;
}
