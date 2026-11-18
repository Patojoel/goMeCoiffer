import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { SessionSummary } from '@gomecoiffer/contracts';
import type { Actor } from '../../../../shared/application/ports.js';
import { AuthenticatedOnly, CurrentActor } from '../../../../shared/infrastructure/security/decorators.js';
import { UnauthenticatedError } from '../../../../shared/infrastructure/security/security-errors.js';
import { GetMySession } from '../../application/queries/get-my-session/get-my-session.query.js';

/** UC-002 — résumé de la session : à la réouverture de l'application, avant tout choix de salon. */
@Controller('salon/session')
export class SessionController {
  constructor(private readonly queries: QueryBus) {}

  @Get()
  @AuthenticatedOnly()
  async summary(@CurrentActor() actor: Actor): Promise<SessionSummary> {
    const summary = await this.queries.execute(new GetMySession(actor.userId, actor.activeSalonId));
    // Compte supprimé alors que la session vivait encore : la session ne vaut plus rien.
    if (!summary) throw new UnauthenticatedError();
    return summary as SessionSummary;
  }
}
