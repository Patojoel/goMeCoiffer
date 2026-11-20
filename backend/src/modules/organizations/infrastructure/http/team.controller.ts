import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  type ChangeCollaboratorRole,
  ChangeCollaboratorRoleSchema,
  type RemoveCollaborator,
  RemoveCollaboratorSchema,
} from '@gomecoiffer/contracts';
import type { Actor } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { CurrentActor, RequiresPermission } from '../../../../shared/infrastructure/security/decorators.js';
import { toChangeCollaboratorRole } from './mappers/change-collaborator-role.request-mapper.js';
import { toListSalonTeam } from './mappers/list-salon-team.request-mapper.js';
import { toRemoveCollaborator } from './mappers/remove-collaborator.request-mapper.js';

/** UC-011 — consulter l'équipe active du salon, changer le rôle d'un collaborateur ou le retirer (D-057). */
@Controller('salon/team')
export class TeamController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  @RequiresPermission('staff:view')
  list(@CurrentActor() actor: Actor) {
    return this.queries.execute(toListSalonTeam(actor));
  }

  @Put(':id/role')
  @HttpCode(200)
  @RequiresPermission('staff:manage')
  changeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: ChangeCollaboratorRoleSchema }) body: ChangeCollaboratorRole,
    @CurrentActor() actor: Actor,
  ) {
    return this.commands.execute(toChangeCollaboratorRole(id, body, actor));
  }

  @Post(':id/removal')
  @HttpCode(200)
  @RequiresPermission('staff:manage')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: RemoveCollaboratorSchema }) body: RemoveCollaborator,
    @CurrentActor() actor: Actor,
  ) {
    return this.commands.execute(toRemoveCollaborator(id, body, actor));
  }
}
