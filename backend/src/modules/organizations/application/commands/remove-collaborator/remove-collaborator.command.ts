import { Command } from '@nestjs/cqrs';
import type { RemoveCollaboratorResponse } from './remove-collaborator.response.js';

export class RemoveCollaborator extends Command<RemoveCollaboratorResponse> {
  constructor(
    readonly salonId: string,
    readonly actorUserId: string,
    readonly actorPermissions: readonly string[],
    readonly membershipId: string,
    readonly expectedVersion: number,
  ) {
    super();
  }
}
