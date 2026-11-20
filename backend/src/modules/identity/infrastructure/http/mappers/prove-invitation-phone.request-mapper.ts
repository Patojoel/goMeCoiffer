import type { ProveInvitationPhone as ProveInvitationPhoneBody } from '@gomecoiffer/contracts';
import { ProveInvitationPhone } from '../../../application/commands/prove-invitation-phone/prove-invitation-phone.command.js';

export const toProveInvitationPhone = (body: ProveInvitationPhoneBody): ProveInvitationPhone =>
  new ProveInvitationPhone(body.phone, body.code);
