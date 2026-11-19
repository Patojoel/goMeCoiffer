import type { DomainEvent } from '../../../../shared/domain/domain-event.js';

/** Aucun abonné à ce stade (UC-007) ; identifiants et rôle seulement, ni nom ni numéro de la personne invitée. */
export class CollaboratorInvited implements DomainEvent {
  constructor(
    readonly invitationId: string,
    readonly salonId: string,
    readonly role: string,
    readonly invitedByUserId: string,
    readonly occurredAt: Date,
  ) {}
}
