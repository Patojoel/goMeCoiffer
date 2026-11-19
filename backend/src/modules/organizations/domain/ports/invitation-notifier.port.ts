import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';

export const INVITATION_NOTIFIER = Symbol('INVITATION_NOTIFIER');
/** Prévient la personne invitée (SMS d'information, jamais de code). Appelé après le commit seulement. */
export interface InvitationNotifier {
  send(to: PhoneNumber, text: string): Promise<void>;
}
