import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type ClientSignedIn,
  type RequestClientCode,
  RequestClientCodeSchema,
  type SignUpCodeSent,
  type VerifyClientCode,
  VerifyClientCodeSchema,
} from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import { Public } from '../../../../shared/infrastructure/security/decorators.js';
import { ClientSessionResponder } from './client-session.responder.js';
import { toRequestClientCode } from './mappers/request-client-code.request-mapper.js';
import { toVerifyClientCode } from './mappers/verify-client-code.request-mapper.js';
import { trackByNetworkAddress } from './rate-limit-trackers.js';

const HOUR_MS = 3_600_000;

/** UC-009 — accès à l'espace client par code SMS. Publique : le jeton CSRF reste exigé (RG-009-01, RG-009-07). */
@Controller('public/client')
@Public()
export class ClientAccessController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly clientSession: ClientSessionResponder,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('code')
  @HttpCode(202)
  @Throttle({ default: { limit: 30, ttl: HOUR_MS, getTracker: trackByNetworkAddress } })
  requestCode(@Body({ schema: RequestClientCodeSchema }) body: RequestClientCode): Promise<SignUpCodeSent> {
    return this.commands.execute(toRequestClientCode(body));
  }

  @Post('session')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: HOUR_MS, getTracker: trackByNetworkAddress } })
  async verifyCode(
    @Body({ schema: VerifyClientCodeSchema }) body: VerifyClientCode,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ClientSignedIn> {
    const account = await this.commands.execute(toVerifyClientCode(body, this.config));
    return this.clientSession.opened(req, res, account);
  }
}
