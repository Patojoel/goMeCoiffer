import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { type SignedIn, type SignedOut, type SignIn, SignInSchema } from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import {
  PER_ADDRESS_THROTTLER,
  SIGN_IN_THROTTLER,
} from '../../../../shared/infrastructure/http/per-address-throttler.js';
import { Public } from '../../../../shared/infrastructure/security/decorators.js';
import { AuthenticatedSessionResponder } from './authenticated-session.responder.js';
import { toSignIn } from './mappers/sign-in.request-mapper.js';
import { toSignOut } from './mappers/sign-out.request-mapper.js';
import { signInAddressTracker, signInDeviceTracker } from './rate-limit-trackers.js';

/**
 * UC-002 — connexion et déconnexion. Publiques : la session n'existe pas encore (ou peut déjà avoir expiré) ;
 * le jeton CSRF reste exigé. La commande décide (politique d'essais, mot de passe) ; le répondeur ouvre la session.
 */
@Controller('public/auth')
@Public()
export class AuthController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly responder: AuthenticatedSessionResponder,
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
    [SIGN_IN_THROTTLER]: { getTracker: signInDeviceTracker },
    [PER_ADDRESS_THROTTLER]: { getTracker: signInAddressTracker },
  })
  async signIn(
    @Body({ schema: SignInSchema }) body: SignIn,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignedIn> {
    const result = await this.commands.execute(toSignIn(body, req, this.config));
    return this.responder.signedIn(req, res, result);
  }

  @Post('sign-out')
  @HttpCode(200)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SignedOut> {
    await this.commands.execute(toSignOut(req));
    return this.responder.signedOut(req, res);
  }
}
