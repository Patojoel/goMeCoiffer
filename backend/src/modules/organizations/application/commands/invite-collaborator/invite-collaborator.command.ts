import { Command } from '@nestjs/cqrs';
import type { SalonRole } from '../../../domain/enums/salon-role.enum.js';
import type { InviteCollaboratorResponse } from './invite-collaborator.response.js';

/** UC-006 : un membre qui a `staff:invite` dans le salon actif invite une personne par son numéro, avec un rôle. */
export class InviteCollaborator extends Command<InviteCollaboratorResponse> {
  constructor(
    readonly salonId: string,
    readonly authorUserId: string,
    /** Permissions de l'auteur dans ce salon, lues dans la session. */
    readonly authorPermissions: readonly string[],
    readonly name: string,
    readonly phone: string,
    readonly role: SalonRole,
  ) {
    super();
  }

  /** Une commande journalisée ne montre ni le nom ni le numéro de la personne invitée. */
  toJSON() {
    return { salonId: this.salonId, authorUserId: this.authorUserId, role: this.role };
  }
}
