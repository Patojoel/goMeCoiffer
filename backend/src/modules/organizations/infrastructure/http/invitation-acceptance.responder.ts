import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { InvitationAccepted } from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import {
  CLOCK,
  type Clock,
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from '../../../../shared/application/ports.js';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import { clearPhoneProofCookie } from '../../../../shared/infrastructure/security/phone-proof-cookie.js';
import {
  openAuthenticatedSession,
  regenerateSessionOnSalon,
} from '../../../../shared/infrastructure/security/authenticated-session.js';
import {
  CSRF_PROTECTION,
  type CsrfProtection,
} from '../../../../shared/infrastructure/security/http-security.js';
import { GetMySession } from '../../../identity/application/queries/get-my-session/get-my-session.query.js';
import type { AcceptInvitationResponse } from '../../application/commands/accept-invitation/accept-invitation.response.js';
import type { SessionAfterAcceptance } from '../../domain/services/session-after-acceptance.js';

type Rotation = (req: Request, accepted: AcceptInvitationResponse) => Promise<void>;

/**
 * Effets HTTP d'une acceptation : la commande a décidé ce que devient la session (RG-007-13). Comme au changement de
 * salon (D-039), le résumé est lu avant toute rotation, puis la session change, le jeton CSRF est renouvelé et les flux de
 * l'ancienne session sont fermés. Aucune règle ici.
 */
@Injectable()
export class InvitationAcceptanceResponder {
  private readonly rotations: Record<Exclude<SessionAfterAcceptance, 'NONE'>, Rotation> = {
    OPEN_NEW: (req, accepted) => openAuthenticatedSession(req, accepted, this.clock.now(), accepted.salonId),
    REGENERATE: (req, accepted) => regenerateSessionOnSalon(req, accepted.salonId),
  };

  constructor(
    private readonly queries: QueryBus,
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Plus aucune invitation à accepter pour ce numéro : la preuve est oubliée côté serveur, le cookie s'efface. */
  private readonly proofCookie: Record<'true' | 'false', (res: Response) => void> = {
    true: (res) => clearPhoneProofCookie(res, this.config),
    false: () => undefined,
  };

  async accepted(req: Request, res: Response, accepted: AcceptInvitationResponse): Promise<InvitationAccepted> {
    const body = await this.respond(req, res, accepted);
    this.proofCookie[`${accepted.proofEnded}`](res);
    return body;
  }

  private respond(req: Request, res: Response, accepted: AcceptInvitationResponse): Promise<InvitationAccepted> {
    return accepted.session === 'NONE'
      ? Promise.resolve({ outcome: 'SIGN_IN_REQUIRED', salonName: accepted.salonName })
      : this.signedIn(req, res, accepted, this.rotations[accepted.session]);
  }

  private async signedIn(
    req: Request,
    res: Response,
    accepted: AcceptInvitationResponse,
    rotate: Rotation,
  ): Promise<InvitationAccepted> {
    const session = await this.queries.execute(new GetMySession(accepted.userId, accepted.salonId));
    const previousSessionId = req.sessionID;
    await rotate(req, accepted);
    const csrfToken = this.csrf.generateCsrfToken(req, res, { overwrite: true });
    this.realtime.closeStreamsOfSession(previousSessionId);
    return { outcome: 'SIGNED_IN', salonName: accepted.salonName, csrfToken, session };
  }
}
