export const PHONE_PROOF_TOKEN_GENERATOR = Symbol('PHONE_PROOF_TOKEN_GENERATOR');
/** Jeton aléatoire non devinable (au moins 128 bits) remis au navigateur qui vient de prouver son numéro. */
export interface ProofTokenGenerator {
  next(): string;
}
