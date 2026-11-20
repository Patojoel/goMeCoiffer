import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type InvitationPhoneProven,
  type ProveInvitationPhone,
  ProveInvitationPhoneSchema,
  type RequestInvitationCode,
  RequestInvitationCodeSchema,
  type SignUpCodeSent,
} from '@gomecoiffer/contracts';
import type { Response } from 'express';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { Public } from '../../../../shared/infrastructure/security/decorators.js';
import { toProveInvitationPhone } from './mappers/prove-invitation-phone.request-mapper.js';
import { toRequestInvitationCode } from './mappers/request-invitation-code.request-mapper.js';
import { PhoneProofResponder } from './phone-proof.responder.js';

const HOUR_MS = 3_600_000;

/**
 * UC-007 — la personne invitée prouve son numéro avant de voir ou d'accepter quoi que ce soit. Publique : la preuve est
 * le code reçu par SMS ; le jeton CSRF reste exigé. La réponse ne dit rien d'une invitation avant la preuve (D-048).
 */
@Controller('public/invitations')
@Public()
export class InvitationAccessController {
  constructor(
    private readonly commands: TransactionalCommandBus,
    private readonly responder: PhoneProofResponder,
  ) {}

  /** Limite par adresse IP en plus des limites par numéro (D-021) : 30 par heure, comme l'inscription. */
  @Post('code')
  @HttpCode(202)
  @Throttle({ default: { limit: 30, ttl: HOUR_MS } })
  requestCode(
    @Body({ schema: RequestInvitationCodeSchema }) body: RequestInvitationCode,
  ): Promise<SignUpCodeSent> {
    return this.commands.execute(toRequestInvitationCode(body));
  }

  @Post('phone-proof')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: HOUR_MS } })
  async prove(
    @Body({ schema: ProveInvitationPhoneSchema }) body: ProveInvitationPhone,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvitationPhoneProven> {
    const proof = await this.commands.execute(toProveInvitationPhone(body));
    return this.responder.proven(res, proof);
  }
}
