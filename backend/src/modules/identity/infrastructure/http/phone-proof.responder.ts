import { Inject, Injectable } from '@nestjs/common';
import type { InvitationPhoneProven } from '@gomecoiffer/contracts';
import type { Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../../../../shared/infrastructure/config/app-config.module.js';
import { setPhoneProofCookie } from '../../../../shared/infrastructure/security/phone-proof-cookie.js';
import type { ProveInvitationPhoneResponse } from '../../application/commands/prove-invitation-phone/prove-invitation-phone.response.js';

/** Effets HTTP d'un numéro prouvé : le jeton part dans un cookie HttpOnly, jamais dans le corps ni dans une URL. */
@Injectable()
export class PhoneProofResponder {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  proven(res: Response, proof: ProveInvitationPhoneResponse): InvitationPhoneProven {
    setPhoneProofCookie(res, proof.token, new Date(proof.provenUntil), this.config);
    return { provenUntil: proof.provenUntil };
  }
}
