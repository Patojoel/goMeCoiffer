import { Command } from '@nestjs/cqrs';
import type { InvitableSalonRole } from '../../../domain/enums/invitable-salon-role.enum.js';
import type { ChangeCollaboratorRoleResponse } from './change-collaborator-role.response.js';

export class ChangeCollaboratorRole extends Command<ChangeCollaboratorRoleResponse> {
  constructor(
    readonly salonId: string,
    readonly actorUserId: string,
    readonly actorPermissions: readonly string[],
    readonly membershipId: string,
    readonly newRole: InvitableSalonRole,
    readonly expectedVersion: number,
  ) {
    super();
  }
}
