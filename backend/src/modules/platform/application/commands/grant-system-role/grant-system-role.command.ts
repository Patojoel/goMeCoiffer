import { Command } from '@nestjs/cqrs';
import type { SystemRole } from '../../../domain/enums/system-role.enum.js';
import type { GrantSystemRoleResponse } from './grant-system-role.response.js';

export class GrantSystemRole extends Command<GrantSystemRoleResponse> {
  constructor(
    readonly actorUserId: string,
    readonly phone: string,
    readonly role: SystemRole,
  ) {
    super();
  }

  toJSON() {
    return { actorUserId: this.actorUserId, role: this.role };
  }
}

