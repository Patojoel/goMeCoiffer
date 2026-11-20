import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';

export const PENDING_INVITATIONS_OF_PHONE = Symbol('PENDING_INVITATIONS_OF_PHONE');
/**
 * Lecture dont la demande de code d'invitation a besoin : ce numéro a-t-il une invitation en attente ? Implémentée en
 * SQL pur dans `application/read-repositories/` ; le résultat ne se lit jamais dans la réponse (D-019).
 */
export interface PendingInvitationsOfPhone {
  existsFor(phone: PhoneNumber, now: Date): Promise<boolean>;
}
