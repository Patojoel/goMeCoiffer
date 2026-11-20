import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  type GrantSystemRole,
  GrantSystemRoleSchema,
  type SystemRole,
} from '@gomecoiffer/contracts';
import type { Actor } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { CurrentActor, RequiresSystemRole } from '../../../../shared/infrastructure/security/decorators.js';
import { toGrantSystemRole } from './mappers/grant-system-role.request-mapper.js';
import { toListPlatformAdmins } from './mappers/list-platform-admins.request-mapper.js';
import { toRevokeSystemRole } from './mappers/revoke-system-role.request-mapper.js';
import { ParseSystemRolePipe } from './pipes/parse-system-role.pipe.js';

/** UC-012 — consulter, attribuer et retirer des rôles système GoMeCoiffer (Super Administrateur uniquement). */
@Controller('admin/platform-roles')
export class PlatformRolesController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  @RequiresSystemRole('SUPER_ADMIN')
  list() {
    return this.queries.execute(toListPlatformAdmins());
  }

  @Post()
  @HttpCode(201)
  @RequiresSystemRole('SUPER_ADMIN')
  grant(
    @Body({ schema: GrantSystemRoleSchema }) body: GrantSystemRole,
    @CurrentActor() actor: Actor,
  ) {
    return this.commands.execute(toGrantSystemRole(body, actor));
  }

  @Delete(':userId/:role')
  @HttpCode(200)
  @RequiresSystemRole('SUPER_ADMIN')
  revoke(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('role', ParseSystemRolePipe) role: SystemRole,
    @CurrentActor() actor: Actor,
  ) {
    return this.commands.execute(toRevokeSystemRole(userId, role, actor));
  }
}

