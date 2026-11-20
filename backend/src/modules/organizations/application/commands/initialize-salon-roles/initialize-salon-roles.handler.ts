import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RolePermissions } from '../../../domain/aggregates/role-permissions.js';
import { ADJUSTABLE_SALON_ROLES } from '../../../domain/enums/permission.enum.js';
import {
  ROLE_PERMISSIONS_REPOSITORY,
  type RolePermissionsRepository,
} from '../../../domain/repositories/write/role-permissions.repository.js';
import { InitializeSalonRoles } from './initialize-salon-roles.command.js';
import type { InitializeSalonRolesResponse } from './initialize-salon-roles.response.js';

@CommandHandler(InitializeSalonRoles)
export class InitializeSalonRolesHandler implements ICommandHandler<InitializeSalonRoles> {
  constructor(
    @Inject(ROLE_PERMISSIONS_REPOSITORY)
    private readonly rolePermissions: RolePermissionsRepository,
  ) {}

  async execute(cmd: InitializeSalonRoles): Promise<InitializeSalonRolesResponse> {
    const defaults = ADJUSTABLE_SALON_ROLES.map((role) =>
      RolePermissions.initializeDefaultForSalon({
        salonId: cmd.salonId,
        role,
        now: cmd.occurredAt,
      }),
    );
    await this.rolePermissions.initializeDefaultsIfAbsent(defaults);
    return { salonId: cmd.salonId, rolesCount: defaults.length };
  }
}

