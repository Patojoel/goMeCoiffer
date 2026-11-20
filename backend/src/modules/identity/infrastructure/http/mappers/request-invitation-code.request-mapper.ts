import type { RequestInvitationCode as RequestInvitationCodeBody } from '@gomecoiffer/contracts';
import { RequestInvitationCode } from '../../../application/commands/request-invitation-code/request-invitation-code.command.js';

export const toRequestInvitationCode = (body: RequestInvitationCodeBody): RequestInvitationCode =>
  new RequestInvitationCode(body.phone);
