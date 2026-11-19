import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { ActiveSalonSelected } from '@gomecoiffer/contracts';
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
import type { SelectActiveSalonResponse } from '../../application/commands/select-active-salon/select-active-salon.response.js';

/**
 * Effets HTTP d'un changement de salon accepté (D-039), dans cet ordre : le résumé est lu avant toute rotation (une
 * panne ne change rien), la session est régénérée, le jeton CSRF renouvelé, puis seulement les flux de l'ancienne
 * session sont fermés. Aucune règle ici : l'appartenance a déjà été vérifiée par la commande.
 */
@Injectable()
export class ActiveSalonResponder {
  constructor(
    private readonly queries: QueryBus,
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
  ) {}

  async activeSalonSelected(
    req: Request,
    res: Response,
    actor: Pick<Actor, 'userId'>,
    selected: SelectActiveSalonResponse,
  ): Promise<ActiveSalonSelected> {
    const session = await this.queries.execute(new GetMySession(actor.userId, selected.salonId));
    const previousSessionId = req.sessionID;
    await regenerateSessionOnSalon(req, selected.salonId);
    const csrfToken = this.csrf.generateCsrfToken(req, res, { overwrite: true });
    this.realtime.closeStreamsOfSession(previousSessionId);
    return { csrfToken, session };
  }
}
