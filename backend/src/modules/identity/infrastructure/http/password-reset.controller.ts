import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type RequestPasswordResetCode,
  RequestPasswordResetCodeSchema,
  type ResetPassword,
  ResetPasswordSchema,
  type SignedIn,
  type SignUpCodeSent,
} from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import { Public } from '../../../../shared/infrastructure/security/decorators.js';
import { AuthenticatedSessionResponder } from './authenticated-session.responder.js';
import { toRequestPasswordResetCode } from './mappers/request-password-reset-code.request-mapper.js';
import { toResetPassword } from './mappers/reset-password.request-mapper.js';

const HOUR_MS = 3_600_000;

/**
 * UC-003 — mot de passe oublié. Publique : la preuve d'identité est le code reçu par SMS ; le jeton CSRF reste
 * exigé. La commande décide ; le répondeur ouvre la session neuve (connexion automatique, D-031).
 */
@Controller('public/auth/password-reset')
@Public()
export class PasswordResetController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly responder: AuthenticatedSessionResponder,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Limite par adresse IP en plus des limites par numéro (D-021) : 30 par heure, comme l'inscription. */
  @Post('code')
  @HttpCode(202)
  @Throttle({ default: { limit: 30, ttl: HOUR_MS } })
  requestCode(
    @Body({ schema: RequestPasswordResetCodeSchema }) body: RequestPasswordResetCode,
  ): Promise<SignUpCodeSent> {
    return this.commands.execute(toRequestPasswordResetCode(body));
  }

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: HOUR_MS } })
  async reset(
    @Body({ schema: ResetPasswordSchema }) body: ResetPassword,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignedIn> {
    const result = await this.commands.execute(toResetPassword(body, req, this.config));
    return this.responder.signedIn(req, res, result);
  }
}
