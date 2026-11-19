import type { Actor } from '../../../../../shared/application/ports.js';
import { CancelInvitation } from '../../../application/commands/cancel-invitation/cancel-invitation.command.js';
import { activeSalonOf } from './active-salon-of.js';

export const toCancelInvitation = (invitationId: string, actor: Actor): CancelInvitation =>
  new CancelInvitation(activeSalonOf(actor), actor.userId, [...actor.permissions], invitationId);
