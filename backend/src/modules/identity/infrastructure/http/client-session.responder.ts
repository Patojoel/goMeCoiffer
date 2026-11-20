import { Inject, Injectable } from '@nestjs/common';
import type { ClientSignedIn } from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import {
  CLOCK,
  type Clock,
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from '../../../../shared/application/ports.js';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import { openClientSession } from '../../../../shared/infrastructure/security/authenticated-session.js';
import {
  CSRF_PROTECTION,
  type CsrfProtection,
} from '../../../../shared/infrastructure/security/http-security.js';
import type { VerifyClientCodeResponse } from '../../application/commands/verify-client-code/verify-client-code.response.js';

/** Ouvre la session client neuve après le commit de `VerifyClientCode`, ferme les flux SSE de l'ancienne session et régénère le jeton CSRF (RG-009-07, RG-009-10). */
@Injectable()
export class ClientSessionResponder {
  constructor(
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async opened(req: Request, res: Response, verified: VerifyClientCodeResponse): Promise<ClientSignedIn> {
    const previousSessionId = req.sessionID;
    await openClientSession(req, verified, this.clock.now(), this.config.CLIENT_SESSION_TTL_HOURS);
    const csrfToken = this.csrf.generateCsrfToken(req, res, { overwrite: true });
    this.realtime.closeStreamsOfSession(previousSessionId);
    return {
      csrfToken,
      session: {
        kind: 'CLIENT',
        maskedPhone: verified.maskedPhone,
      },
    };
  }
}
