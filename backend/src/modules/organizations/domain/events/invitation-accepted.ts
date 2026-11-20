import type { DomainEvent } from '../../../../shared/domain/domain-event.js';

/** Identifiants et rôle seulement : ni le nom ni le numéro saisis par le salon. Aucun abonné à ce stade (UC-008). */
export class InvitationAccepted implements DomainEvent {
  constructor(
    readonly invitationId: string,
    readonly salonId: string,
    readonly role: string,
    readonly userId: string,
    readonly occurredAt: Date,
  ) {}
}
