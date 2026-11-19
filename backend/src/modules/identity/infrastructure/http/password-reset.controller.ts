import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Throttle } from '@nestjs/throttler';
import {
  type RequestPasswordResetCode as RequestPasswordResetCodeBody,
  RequestPasswordResetCodeSchema,
  type ResetPassword as ResetPasswordBody,
  ResetPasswordSchema,
  type SessionSummary,
  type SignedIn,
  type SignUpCodeSent,
} from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import { CLOCK, type Clock } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import { openAuthenticatedSession } from '../../../../shared/infrastructure/security/authenticated-session.js';
import { Public } from '../../../../shared/infrastructure/security/decorators.js';
import {
  CSRF_PROTECTION,
  type CsrfProtection,
} from '../../../../shared/infrastructure/security/http-security.js';
import { UnauthenticatedError } from '../../../../shared/infrastructure/security/security-errors.js';
import { RequestPasswordResetCode } from '../../application/commands/request-password-reset-code/request-password-reset-code.command.js';
import { ResetPassword } from '../../application/commands/reset-password/reset-password.command.js';
import { GetMySession } from '../../application/queries/get-my-session/get-my-session.query.js';
import { readDeviceTokens, setDeviceCookie } from './device-cookie.js';

const HOUR_MS = 3_600_000;

/**
 * UC-003 — mot de passe oublié. Publique : la preuve d'identité est le code reçu par SMS ; le jeton CSRF reste
 * exigé. La commande décide ; cette couche ouvre la session neuve (connexion automatique, D-031).
 */
@Controller('public/auth/password-reset')
@Public()
export class PasswordResetController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly queries: QueryBus,
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Limite par adresse IP en plus des limites par numéro (D-021) : 30 par heure, comme l'inscription. */
  @Post('code')
  @HttpCode(202)
  @Throttle({ default: { limit: 30, ttl: HOUR_MS } })
  requestCode(
    @Body({ schema: RequestPasswordResetCodeSchema }) body: RequestPasswordResetCodeBody,
  ): Promise<SignUpCodeSent> {
    return this.commands.execute(new RequestPasswordResetCode(body.phone));
  }

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: HOUR_MS } })
  async reset(
    @Body({ schema: ResetPasswordSchema }) body: ResetPasswordBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignedIn> {
    const result = await this.commands.execute(
      new ResetPassword({
        phone: body.phone,
        code: body.code,
        newPassword: body.newPassword,
        deviceTokens: readDeviceTokens(req, this.config),
      }),
    );
    // Levé après le commit : l'essai de code raté reste compté.
    if (result.status === 'REFUSED') throw result.refusal;

    await openAuthenticatedSession(req, result, this.clock.now());
    setDeviceCookie(res, result.deviceTokens, this.config);
    const csrfToken = this.csrf.generateCsrfToken(req, res, { overwrite: true });
    const session = await this.queries.execute(new GetMySession(result.userId, null));
    if (!session) throw new UnauthenticatedError();
    return { csrfToken, session: session as SessionSummary };
  }
}
