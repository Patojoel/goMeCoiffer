import { Query } from '@nestjs/cqrs';
import type { SalonInvitationReadModel } from './list-salon-invitations.read-model.js';

/** `salonId` est le salon actif de la session serveur, jamais une valeur du client. */
export class ListSalonInvitations extends Query<readonly SalonInvitationReadModel[]> {
  constructor(readonly salonId: string) {
    super();
  }
}
