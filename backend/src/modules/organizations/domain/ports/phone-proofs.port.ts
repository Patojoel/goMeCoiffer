import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';

export const PHONE_PROOFS = Symbol('PHONE_PROOFS');

/**
 * Un numéro prouvé par ce navigateur. Seul `identity` en fabrique (classe à constructeur privé) et `provide` le
 * vérifie à l'exécution : une valeur forgée par un appelant n'ouvre aucun compte.
 */
export interface ProvenPhone {
  readonly phone: PhoneNumber;
  readonly provenAt: Date;
}

/** Preuve de numéro délivrée par `identity` : le numéro que ce navigateur a prouvé, s'il le prouve encore. */
export interface PhoneProofs {
  phoneProvenBy(token: string | null, now: Date): Promise<ProvenPhone | null>;
  /** Oublie toutes les preuves de ce numéro (plus aucune invitation à accepter, ou déconnexion). */
  forgetProofsOf(proven: ProvenPhone): Promise<void>;
}
