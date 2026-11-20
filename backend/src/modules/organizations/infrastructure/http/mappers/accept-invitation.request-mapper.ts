import type { AcceptInvitation as AcceptInvitationBody } from '@gomecoiffer/contracts';
import type { Request } from 'express';
import type { AppConfig } from '../../../../../shared/infrastructure/config/app-config.module.js';
import { readPhoneProofToken } from '../../../../../shared/infrastructure/security/phone-proof-cookie.js';
import { AcceptInvitation } from '../../../application/commands/accept-invitation/accept-invitation.command.js';

/**
 * Le numéro n'est lu nulle part dans la requête : la commande le retrouve par le jeton de preuve du cookie. La
 * session ouverte sur ce navigateur ne sert qu'à choisir la session de réponse, jamais à désigner qui rejoint.
 */
export const toAcceptInvitation = (
  invitationId: string,
  body: AcceptInvitationBody,
  req: Request,
  config: AppConfig,
): AcceptInvitation =>
  new AcceptInvitation({
    invitationId,
    proofToken: readPhoneProofToken(req, config),
    details: body.details,
    session:
      req.session?.userId && (req.session.kind ?? 'STAFF') === 'STAFF'
        ? {
            userId: req.session.userId,
            credentialsVersion: req.session.credentialsVersion ?? null,
            authenticatedAt: req.session.authenticatedAt ?? null,
          }
        : null,
    sessionMaxAgeHours: config.SESSION_MAX_AGE_HOURS,
  });
