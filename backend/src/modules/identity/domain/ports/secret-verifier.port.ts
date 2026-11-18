/** Comparaison d'un code à son empreinte, fournie par l'infrastructure (temps constant). */
export interface SecretVerifier {
  matches(candidate: string, hash: string): boolean;
}
