import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { Invitation } from '../../aggregates/invitation.js';

export const INVITATION_REPOSITORY = Symbol('INVITATION_REPOSITORY');
export interface InvitationRepository {
  /** `InvitationAlreadyPendingError` si le numéro a déjà une invitation en attente dans le salon, même à deux requêtes. */
  add(invitation: Invitation): Promise<void>;
  /** `ConcurrencyConflictError` si l'invitation a changé depuis son chargement. */
  save(invitation: Invitation): Promise<void>;
  /** `InvitationNotFoundError` si l'invitation n'existe pas **dans ce salon**. */
  getOfSalon(salonId: string, id: string): Promise<Invitation>;
  /** L'invitation encore marquée en attente pour ce numéro, échue ou non. */
  findPendingOfPhone(salonId: string, phone: PhoneNumber): Promise<Invitation | null>;
  /**
   * Efface nom et numéro des invitations non acceptées dont la fin remonte à `before` ou avant (une en attente
   * échue passe à expirée) ; renvoie leur nombre. Rejouable : une invitation déjà effacée n'est plus comptée.
   */
  purgePersonalDataEndedBefore(before: Date): Promise<number>;
}
