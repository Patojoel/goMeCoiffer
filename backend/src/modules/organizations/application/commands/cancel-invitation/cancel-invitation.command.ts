import { Command } from '@nestjs/cqrs';
import type { CancelInvitationResponse } from './cancel-invitation.response.js';

/** UC-006 (A7) : annuler une invitation en attente du salon actif. */
export class CancelInvitation extends Command<CancelInvitationResponse> {
  constructor(
    readonly salonId: string,
    readonly authorUserId: string,
    readonly authorPermissions: readonly string[],
    readonly invitationId: string,
  ) {
    super();
  }
}
