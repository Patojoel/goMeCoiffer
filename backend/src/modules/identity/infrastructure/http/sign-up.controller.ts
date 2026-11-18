import { Body, Controller, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type ConfirmSignUp as ConfirmSignUpBody,
  ConfirmSignUpSchema,
  type RequestSignUpCode as RequestSignUpCodeBody,
  RequestSignUpCodeSchema,
  type SignedUp,
  type SignUpCodeSent,
} from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import { CLOCK, type Clock } from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { openAuthenticatedSession } from '../../../../shared/infrastructure/security/authenticated-session.js';
import { Public } from '../../../../shared/infrastructure/security/decorators.js';
import {
  CSRF_PROTECTION,
  type CsrfProtection,
} from '../../../../shared/infrastructure/security/http-security.js';
import { ConfirmSignUp } from '../../application/commands/confirm-sign-up/confirm-sign-up.command.js';
import { RequestSignUpCode } from '../../application/commands/request-sign-up-code/request-sign-up-code.command.js';

const HOUR_MS = 3_600_000;

/** UC-001 — inscription du propriétaire, publique : la preuve d'identité est le code reçu par SMS. */
@Controller('public/sign-up')
@Public()
export class SignUpController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    @Inject(CSRF_PROTECTION) private readonly csrf: CsrfProtection,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Limite par adresse IP en plus des limites par numéro (D-021). */
  @Post('code')
  @HttpCode(202)
  @Throttle({ default: { limit: 30, ttl: HOUR_MS } })
  requestCode(
    @Body({ schema: RequestSignUpCodeSchema }) body: RequestSignUpCodeBody,
  ): Promise<SignUpCodeSent> {
    return this.commands.execute(new RequestSignUpCode(body.phone));
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 60, ttl: HOUR_MS } })
  async confirm(
    @Body({ schema: ConfirmSignUpSchema }) body: ConfirmSignUpBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignedUp> {
    const result = await this.commands.execute(new ConfirmSignUp({ ...body, email: body.email ?? null }));
    // Levé après le commit : l'essai raté reste compté.
    if (result.status === 'REFUSED') throw result.refusal;

    await openAuthenticatedSession(req, result.userId, this.clock.now());
    return {
      userId: result.userId,
      nextStep: result.nextStep,
      csrfToken: this.csrf.generateCsrfToken(req, res, { overwrite: true }),
    };
  }
}
