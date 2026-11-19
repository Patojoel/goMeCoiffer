import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { type InviteCollaborator, InviteCollaboratorSchema } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { CurrentActor, RequiresPermission } from '../../../../shared/infrastructure/security/decorators.js';
import { toCancelInvitation } from './mappers/cancel-invitation.request-mapper.js';
import { toInviteCollaborator } from './mappers/invite-collaborator.request-mapper.js';
import { toListSalonInvitations } from './mappers/list-salon-invitations.request-mapper.js';

/** UC-006 — inviter un collaborateur dans le salon actif et annuler une invitation. */
@Controller('salon/invitations')
export class InvitationsController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Get()
  @RequiresPermission('staff:invite')
  list(@CurrentActor() actor: Actor) {
    return this.queries.execute(toListSalonInvitations(actor));
  }

  @Post()
  @HttpCode(201)
  @RequiresPermission('staff:invite')
  invite(@Body({ schema: InviteCollaboratorSchema }) body: InviteCollaborator, @CurrentActor() actor: Actor) {
    return this.commands.execute(toInviteCollaborator(body, actor));
  }

  @Post(':id/cancellation')
  @HttpCode(200)
  @RequiresPermission('staff:invite')
  cancel(@Param('id', ParseUUIDPipe) id: string, @CurrentActor() actor: Actor) {
    return this.commands.execute(toCancelInvitation(id, actor));
  }
}
