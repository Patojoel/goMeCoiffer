import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import {
  type AcceptInvitation,
  AcceptInvitationSchema,
  type InvitationAccepted,
} from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import { Public } from '../../../../shared/infrastructure/security/decorators.js';
import { InvitationAcceptanceResponder } from './invitation-acceptance.responder.js';
import { toAcceptInvitation } from './mappers/accept-invitation.request-mapper.js';
import { toListInvitationsForProvenPhone } from './mappers/list-invitations-for-proven-phone.request-mapper.js';

const HOUR_MS = 3_600_000;

/**
 * UC-007 — accepter une invitation. Publique : l'identité est le numéro prouvé (cookie de preuve), jamais la session ;
 * le jeton CSRF reste exigé.
 */
@Controller('public/invitations')
@Public()
export class InvitationAcceptanceController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly queries: QueryBus,
    private readonly responder: InvitationAcceptanceResponder,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post(':id/acceptance')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: HOUR_MS } })
  async accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body({ schema: AcceptInvitationSchema }) body: AcceptInvitation,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvitationAccepted> {
    const accepted = await this.commands.execute(toAcceptInvitation(id, body, req, this.config));
    return this.responder.accepted(req, res, accepted);
  }

  /** Rien sans preuve valide : sans cookie de preuve, ou preuve échue, la query refuse (`PHONE_PROOF_REQUIRED`). */
  @Get()
  @Throttle({ default: { limit: 60, ttl: HOUR_MS } })
  list(@Req() req: Request) {
    return this.queries.execute(toListInvitationsForProvenPhone(req, this.config));
  }
}
