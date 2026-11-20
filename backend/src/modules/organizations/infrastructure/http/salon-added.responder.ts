import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { SalonAdded } from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import {
  type Actor,
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from '../../../../shared/application/ports.js';
import { regenerateSessionOnSalon } from '../../../../shared/infrastructure/security/authenticated-session.js';
import {
  CSRF_PROTECTION,
  type CsrfProtection,
} from '../../../../shared/infrastructure/security/http-security.js';
import { GetMySession } from '../../../identity/application/queries/get-my-session/get-my-session.query.js';
import type { AddSalonToOrganizationResponse } from '../../application/commands/add-salon-to-organization/add-salon-to-organization.response.js';

/**
 * Effets HTTP après l'ajout d'un salon (D-056, D-039) : lecture du résumé avant rotation, régénération de la session
 * sur le nouveau salon actif, renouvellement du jeton CSRF, puis fermeture des flux SSE de l'ancienne session.
 */
@Injectable()
export class SalonAddedResponder {
  constructor(
    private readonly queries: QueryBus,
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async added(
    req: Request,
    res: Response,
    actor: Pick<Actor, 'userId'>,
    added: AddSalonToOrganizationResponse,
  ): Promise<SalonAdded> {
    const session = await this.queries.execute(new GetMySession(actor.userId, added.salonId));
    const previousSessionId = req.sessionID;
    await regenerateSessionOnSalon(req, added.salonId);
    const csrfToken = this.csrf.generateCsrfToken(req, res, { overwrite: true });
    this.realtime.closeStreamsOfSession(previousSessionId);
    return { ...added, csrfToken, session };
  }
}

