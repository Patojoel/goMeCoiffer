import { AlreadySalonMemberError } from '../exceptions/already-salon-member.error.js';
import { InvitationAlreadyPendingError } from '../exceptions/invitation-already-pending.error.js';
import { InvitationQuotaReachedError } from '../exceptions/invitation-quota-reached.error.js';
import { PendingInvitationsLimitError } from '../exceptions/pending-invitations-limit.error.js';

/** Limites contre l'abus d'envoi (D-044) : l'inscription est libre, un salon ne doit pas pouvoir arroser des inconnus. */
export const SALON_INVITATIONS_PER_DAY = 20;
export const SALON_PENDING_INVITATIONS_LIMIT = 50;
export const TEXT_MESSAGES_PER_PHONE_PER_DAY = 3;
/** Conservation du nom et du numéro d'une invitation non acceptée après sa fin (D-045). */
export const ENDED_INVITATION_RETENTION_DAYS = 30;
const DAY_MS = 86_400_000;

/** Début de la fenêtre glissante de 24 h, borne incluse. */
export const dailyWindowStart = (now: Date): Date => new Date(now.getTime() - DAY_MS);

export const InvitationAdmission = {
  assertAdmissible(facts: {
    isActiveMember: boolean;
    hasPendingInvitation: boolean;
    sentInLastDay: number;
    pendingCount: number;
  }): void {
    if (facts.isActiveMember) throw new AlreadySalonMemberError();
    if (facts.hasPendingInvitation) throw new InvitationAlreadyPendingError();
    if (facts.sentInLastDay >= SALON_INVITATIONS_PER_DAY) throw new InvitationQuotaReachedError();
    if (facts.pendingCount >= SALON_PENDING_INVITATIONS_LIMIT)
      throw new PendingInvitationsLimitError(SALON_PENDING_INVITATIONS_LIMIT);
  },

  /** Au-delà de la limite du numéro, l'invitation est enregistrée sans SMS : jamais refusée pour ce motif. */
  mayTextMessage: (textMessagesInLastDay: number): boolean =>
    textMessagesInLastDay < TEXT_MESSAGES_PER_PHONE_PER_DAY,
};
