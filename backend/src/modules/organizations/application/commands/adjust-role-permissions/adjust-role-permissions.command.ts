import { Command } from '@nestjs/cqrs';
import type { InvitableSalonRole } from '../../../domain/enums/invitable-salon-role.enum.js';
import type { AdjustRolePermissionsResponse } from './adjust-role-permissions.response.js';

export class AdjustRolePermissions extends Command<AdjustRolePermissionsResponse> {
  constructor(
    readonly salonId: string,
    readonly actorUserId: string,
    readonly role: InvitableSalonRole,
    readonly permissions: readonly string[],
    readonly expectedVersion: number,
    readonly resetToDefault?: boolean,
  ) {
    super();
  }
}

