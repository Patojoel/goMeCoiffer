import { Controller, Get, Req } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { ClientSessionSummary } from '@gomecoiffer/contracts';
import type { Request } from 'express';
import type { Actor } from '../../../../shared/application/ports.js';
import { ClientArea, CurrentActor } from '../../../../shared/infrastructure/security/decorators.js';
import { toGetMyClientSession } from './mappers/get-my-client-session.request-mapper.js';

/** UC-009 — résumé de la session dans l'espace client (`/api/client/*`, D-055, RG-009-08 à RG-009-10). */
@Controller('client/session')
@ClientArea()
export class ClientSessionController {
  constructor(private readonly queries: QueryBus) {}

  @Get()
  summary(@CurrentActor() actor: Actor, @Req() req: Request): Promise<ClientSessionSummary> {
    return this.queries.execute(toGetMyClientSession(actor, req));
  }
}
