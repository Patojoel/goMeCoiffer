import type { ProvenPhone } from './phone-proofs.port.js';

export const INVITEE_ACCOUNTS = Symbol('INVITEE_ACCOUNTS');

export interface NewAccountDetails {
  readonly name: string;
  readonly password: string;
  readonly termsAccepted: boolean;
}

export interface InviteeAccount {
  readonly userId: string;
  /** À recopier dans la session ouverte pour ce compte. */
  readonly credentialsVersion: number;
  /** Compte créé ou complété par cette acceptation (et non un compte du personnel déjà existant). */
  readonly created: boolean;
}

/**
 * Le compte de la personne invitée, fourni par `identity` dans la transaction de l'acceptation (UC-007, exception
 * « une commande, plusieurs agrégats » : docs/domains.md). Sans détails, le compte doit déjà être un compte du
 * personnel (inchangé) ; avec détails, il est créé ou complété. L'inverse lève `AccountStateChangedError`.
 */
export interface InviteeAccounts {
  provide(input: { proven: ProvenPhone; details: NewAccountDetails | null; now: Date }): Promise<InviteeAccount>;
}
