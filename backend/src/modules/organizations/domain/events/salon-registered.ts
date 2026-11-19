import type { DomainEvent } from '../../../../shared/domain/domain-event.js';

/** Aucun abonné à ce stade : le lot 7 s'y branchera (activation, essai) ; ni nom ni téléphone dans la charge. */
export class SalonRegistered implements DomainEvent {
  constructor(
    readonly salonId: string,
    readonly organizationId: string,
    readonly occurredAt: Date,
  ) {}
}
