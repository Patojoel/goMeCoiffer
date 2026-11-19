import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  type SessionSummary,
  type SignedIn,
  type SignedOut,
  type SignIn as SignInBody,
  SignInSchema,
} from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import {
  PER_ADDRESS_THROTTLER,
  SIGN_IN_THROTTLER,
} from '../../../../shared/infrastructure/http/per-address-throttler.js';
import { normalizeNetworkAddress } from '../../domain/value-objects/network-address.js';
import { CLOCK, type Clock } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import { openAuthenticatedSession } from '../../../../shared/infrastructure/security/authenticated-session.js';
import { Public } from '../../../../shared/infrastructure/security/decorators.js';
import {
  cookieName,
  CSRF_COOKIE_BASE,
  CSRF_PROTECTION,
  type CsrfProtection,
  securityCookieOptions,
} from '../../../../shared/infrastructure/security/http-security.js';
import { UnauthenticatedError } from '../../../../shared/infrastructure/security/security-errors.js';
import { SignIn } from '../../application/commands/sign-in/sign-in.command.js';
import { SignOut } from '../../application/commands/sign-out/sign-out.command.js';
import { GetMySession } from '../../application/queries/get-my-session/get-my-session.query.js';
import { rateLimitTracker, readDeviceTokens, setDeviceCookie } from './device-cookie.js';

/**
 * UC-002 — connexion et déconnexion. Publiques : la session n'existe pas encore (ou peut déjà avoir expiré) ;
 * le jeton CSRF reste exigé. La commande décide (politique d'essais, mot de passe) ; cette couche ouvre la session.
 */
@Controller('public/auth')
@Public()
export class AuthController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly queries: QueryBus,
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Deux filets, en plus de la politique d'essais (D-025), limites lues dans la configuration
   * (`SIGN_IN_RATE_LIMIT_PER_HOUR`, `SIGN_IN_ADDRESS_RATE_LIMIT_PER_HOUR`) :
   * - par appareil : un navigateur qui porte un cookie d'appareil a son propre compteur, pour qu'un tiers de même
   *   adresse ne bloque pas un appareil reconnu ; sans cookie, compté par adresse ;
   * - par adresse seule (/64 en IPv6), toujours appliqué : des cookies forgés n'ouvrent pas de compteur neuf ici.
   * Le limiteur général (`default`) ne s'applique pas à cette route : il compterait par adresse.
   */
  @Post('sign-in')
  @HttpCode(200)
  @SkipThrottle({ default: true })
  @Throttle({
    [SIGN_IN_THROTTLER]: { getTracker: (req) => rateLimitTracker(req as Request) },
    [PER_ADDRESS_THROTTLER]: {
      getTracker: (req) => `address:${normalizeNetworkAddress(String(req.ip ?? 'unknown'))}`,
    },
  })
  async signIn(
    @Body({ schema: SignInSchema }) body: SignInBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignedIn> {
    const result = await this.commands.execute(
      new SignIn({
        phone: body.phone,
        password: body.password,
        deviceTokens: readDeviceTokens(req, this.config),
        networkAddress: req.ip ?? 'unknown',
      }),
    );
    // Levé après le commit : l'échec reste compté.
    if (result.status === 'REFUSED') throw result.refusal;

    await openAuthenticatedSession(req, result, this.clock.now());
    setDeviceCookie(res, result.deviceTokens, this.config);
    const csrfToken = this.csrf.generateCsrfToken(req, res, { overwrite: true });
    const session = await this.queries.execute(new GetMySession(result.userId, null));
    if (!session) throw new UnauthenticatedError();
    return { csrfToken, session: session as SessionSummary };
  }

  /** Idempotente : même confirmation avec ou sans session. L'appareil reste reconnu (cookie d'appareil conservé). */
  @Post('sign-out')
  @HttpCode(200)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SignedOut> {
    const userId = req.session?.userId;
    if (userId) await this.commands.execute(new SignOut(userId));
    await new Promise<void>((done) => (req.session ? req.session.destroy(() => done()) : done()));
    res.clearCookie(
      cookieName(this.config, this.config.SESSION_COOKIE_NAME),
      securityCookieOptions(this.config),
    );
    res.clearCookie(cookieName(this.config, CSRF_COOKIE_BASE), securityCookieOptions(this.config));
    return { signedOut: true };
  }
}
