import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type ConfirmSignUp,
  ConfirmSignUpSchema,
  type RequestSignUpCode,
  RequestSignUpCodeSchema,
  type SignedUp,
  type SignUpCodeSent,
} from '@gomecoiffer/contracts';
import type { Request, Response } from 'express';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { Public } from '../../../../shared/infrastructure/security/decorators.js';
import { AuthenticatedSessionResponder } from './authenticated-session.responder.js';
import { toConfirmSignUp } from './mappers/confirm-sign-up.request-mapper.js';
import { toRequestSignUpCode } from './mappers/request-sign-up-code.request-mapper.js';

const HOUR_MS = 3_600_000;

/** UC-001 — inscription du propriétaire, publique : la preuve d'identité est le code reçu par SMS. */
@Controller('public/sign-up')
@Public()
export class SignUpController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly responder: AuthenticatedSessionResponder,
  ) {}

  /** Limite par adresse IP en plus des limites par numéro (D-021). */
  @Post('code')
  @HttpCode(202)
  @Throttle({ default: { limit: 30, ttl: HOUR_MS } })
  requestCode(@Body({ schema: RequestSignUpCodeSchema }) body: RequestSignUpCode): Promise<SignUpCodeSent> {
    return this.commands.execute(toRequestSignUpCode(body));
  }

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 60, ttl: HOUR_MS } })
  async confirm(
    @Body({ schema: ConfirmSignUpSchema }) body: ConfirmSignUp,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignedUp> {
    const result = await this.commands.execute(toConfirmSignUp(body));
    return this.responder.signedUp(req, res, result);
  }
}
