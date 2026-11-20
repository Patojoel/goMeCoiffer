import { Body, Controller, Get, HttpCode, Param, Put } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  type AdjustableSalonRole,
  type AdjustRolePermissions,
  AdjustRolePermissionsSchema,
} from '@gomecoiffer/contracts';
import type { Actor } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { CurrentActor, RequiresPermission } from '../../../../shared/infrastructure/security/decorators.js';
import { toAdjustRolePermissions } from './mappers/adjust-role-permissions.request-mapper.js';
import { toGetSalonRoles } from './mappers/get-salon-roles.request-mapper.js';
import { ParseAdjustableSalonRolePipe } from './pipes/parse-adjustable-salon-role.pipe.js';

/** UC-008 — consulter et ajuster les permissions des rôles du salon actif (propriétaire uniquement). */
@Controller('salon/roles')
export class SalonRolesController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  @RequiresPermission('roles:administer')
  list(@CurrentActor() actor: Actor) {
    return this.queries.execute(toGetSalonRoles(actor));
  }

  @Put(':role/permissions')
  @HttpCode(200)
  @RequiresPermission('roles:administer')
  adjust(
    @Param('role', ParseAdjustableSalonRolePipe) role: AdjustableSalonRole,
    @Body({ schema: AdjustRolePermissionsSchema }) body: AdjustRolePermissions,
    @CurrentActor() actor: Actor,
  ) {
    return this.commands.execute(toAdjustRolePermissions(role, body, actor));
  }
}

