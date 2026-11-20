import type { Request } from 'express';
import type { AppConfig } from '../../../../../shared/infrastructure/config/app-config.module.js';
import { readPhoneProofToken } from '../../../../../shared/infrastructure/security/phone-proof-cookie.js';
import { ListInvitationsForProvenPhone } from '../../../application/queries/list-invitations-for-proven-phone/list-invitations-for-proven-phone.query.js';

export const toListInvitationsForProvenPhone = (
  req: Request,
  config: AppConfig,
): ListInvitationsForProvenPhone => new ListInvitationsForProvenPhone(readPhoneProofToken(req, config));
