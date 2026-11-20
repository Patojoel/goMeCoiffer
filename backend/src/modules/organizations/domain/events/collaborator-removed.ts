import type { DomainEvent } from '../../../../shared/domain/domain-event.js';
import type { SalonRole } from '../enums/salon-role.enum.js';

export class CollaboratorRemoved implements DomainEvent {
  constructor(
    readonly membershipId: string,
    readonly salonId: string,
    readonly userId: string,
    readonly roleAtRemoval: SalonRole,
    readonly removedByUserId: string,
    readonly occurredAt: Date,
  ) {}
}
