import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';

export const INVITATION_CHECKS = Symbol('INVITATION_CHECKS');
/** Lectures dont `InviteCollaborator` a besoin sans charger d'agrégat. */
export interface InvitationChecks {
  /** Verrou de transaction sur le salon (à prendre avant le verrou par numéro). */
  lockSalon(salonId: string): Promise<void>;
  /** Verrou de transaction sur le numéro (toujours après le verrou du salon). */
  lockPhone(phone: PhoneNumber): Promise<void>;
  /** Une appartenance ACTIVE dans ce salon pour le compte qui porte ce numéro. */
  isActiveMember(salonId: string, phone: PhoneNumber): Promise<boolean>;
  /** Invitations envoyées par le salon depuis `since` (incluse), quel que soit leur état. */
  invitationsSentSince(salonId: string, since: Date): Promise<number>;
  /** Une invitation en attente et non échue à `now` existe pour ce numéro, tous salons confondus. */
  hasPendingInvitation(phone: PhoneNumber, now: Date): Promise<boolean>;
  /** Invitations du salon en attente et non échues à `now`. */
  pendingCount(salonId: string, now: Date): Promise<number>;
  /** Salons distincts ayant déclenché un SMS d'invitation pour ce numéro depuis `since` (inclus). */
  textMessagesSentSince(phone: PhoneNumber, since: Date): Promise<number>;
  salonOf(salonId: string): Promise<{ readonly name: string; readonly timezone: string }>;
}
