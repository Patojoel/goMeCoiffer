import type { SessionAfterAcceptance } from '../../../domain/services/session-after-acceptance.js';

export interface AcceptInvitationResponse {
  readonly userId: string;
  /** Version des identifiants du compte, à recopier dans une session neuve. */
  readonly credentialsVersion: number;
  readonly salonId: string;
  readonly salonName: string;
  /** Ce que le répondeur HTTP fait de la session : l'ouvrir à neuf, la régénérer dans le salon rejoint, ou ne rien faire. */
  readonly session: SessionAfterAcceptance;
  /** Plus aucune invitation en attente pour ce numéro : ses preuves sont oubliées, le répondeur efface le cookie. */
  readonly proofEnded: boolean;
}
