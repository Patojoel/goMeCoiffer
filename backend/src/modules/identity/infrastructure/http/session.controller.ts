import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { SessionSummary } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../shared/application/ports.js';
import { AuthenticatedOnly, CurrentActor } from '../../../../shared/infrastructure/security/decorators.js';
import { toGetMySession } from './mappers/get-my-session.request-mapper.js';

/** UC-002 — résumé de la session : à la réouverture de l'application, avant tout choix de salon. */
@Controller('salon/session')
export class SessionController {
  constructor(private readonly queries: QueryBus) {}

  @Get()
  @AuthenticatedOnly()
  summary(@CurrentActor() actor: Actor): Promise<SessionSummary> {
    return this.queries.execute(toGetMySession(actor));
  }
}
