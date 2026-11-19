import type { DomainEvent } from '../../../../shared/domain/domain-event.js';

export class InvitationCancelled implements DomainEvent {
  constructor(
    readonly invitationId: string,
    readonly salonId: string,
    readonly cancelledByUserId: string,
    readonly occurredAt: Date,
  ) {}
}
