import type { DomainEvent } from '../../../../shared/domain/domain-event.js';

export class OrganizationFounded implements DomainEvent {
  constructor(
    readonly organizationId: string,
    readonly ownerUserId: string,
    readonly occurredAt: Date,
  ) {}
}
