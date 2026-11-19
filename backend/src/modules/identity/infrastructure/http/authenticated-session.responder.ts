import { Inject, Injectable } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { SignedIn, SignedOut, SignedUp } from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import { CLOCK, type Clock } from '../../../../shared/application/ports.js';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import { openAuthenticatedSession } from '../../../../shared/infrastructure/security/authenticated-session.js';
import {
  cookieName,
  CSRF_COOKIE_BASE,
  CSRF_PROTECTION,
  type CsrfProtection,
  securityCookieOptions,
} from '../../../../shared/infrastructure/security/http-security.js';
import type { ConfirmSignUpResponse } from '../../application/commands/confirm-sign-up/confirm-sign-up.response.js';
import { toGetMySession } from './mappers/get-my-session.request-mapper.js';
import { setDeviceCookie } from './device-cookie.js';

interface Account {
  readonly userId: string;
  readonly credentialsVersion: number;
}

/**
 * Effets HTTP qui suivent le commit d'une commande d'authentification : session, cookies, jeton CSRF. La commande a
 * déjà décidé ; ici on ne fait que traduire sa réponse en transport.
 */
@Injectable()
export class AuthenticatedSessionResponder {
  constructor(
    private readonly queries: QueryBus,
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Connexion et réinitialisation : session neuve, cookie d'appareil renouvelé, résumé de session. */
  async signedIn(
    req: Request,
    res: Response,
    account: Account & { readonly deviceTokens: readonly string[] },
  ): Promise<SignedIn> {
    await openAuthenticatedSession(req, account, this.clock.now());
    setDeviceCookie(res, account.deviceTokens, this.config);
    const csrfToken = this.csrf.generateCsrfToken(req, res, { overwrite: true });
    const session = await this.queries.execute(
      toGetMySession({ userId: account.userId, activeSalonId: null }),
    );
    return { csrfToken, session };
  }

  async signedUp(req: Request, res: Response, signUp: ConfirmSignUpResponse): Promise<SignedUp> {
    await openAuthenticatedSession(req, signUp, this.clock.now());
    return {
      userId: signUp.userId,
      nextStep: signUp.nextStep,
      csrfToken: this.csrf.generateCsrfToken(req, res, { overwrite: true }),
    };
  }

  /** Idempotente : même confirmation avec ou sans session. L'appareil reste reconnu (cookie d'appareil conservé). */
  async signedOut(req: Request, res: Response): Promise<SignedOut> {
    await new Promise<void>((done) => (req.session ? req.session.destroy(() => done()) : done()));
    res.clearCookie(
      cookieName(this.config, this.config.SESSION_COOKIE_NAME),
      securityCookieOptions(this.config),
    );
    res.clearCookie(cookieName(this.config, CSRF_COOKIE_BASE), securityCookieOptions(this.config));
    return { signedOut: true };
  }
}
