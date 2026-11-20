import { Command } from '@nestjs/cqrs';
import type { SystemRole } from '../../../domain/enums/system-role.enum.js';
import type { RevokeSystemRoleResponse } from './revoke-system-role.response.js';

export class RevokeSystemRole extends Command<RevokeSystemRoleResponse> {
  constructor(
    readonly actorUserId: string,
    readonly targetUserId: string,
    readonly role: SystemRole,
  ) {
    super();
  }
}

