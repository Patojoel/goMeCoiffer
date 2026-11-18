export const PASSWORD_VERIFIER = Symbol('PASSWORD_VERIFIER');
/** Vérification des mots de passe à la connexion : tient aussi l'empreinte factice et les réglages en vigueur. */
export interface PasswordVerifier {
  /** `hash = null` (pas de compte, pas de mot de passe) : vérifie contre l'empreinte factice, même coût, toujours faux. */
  verify(password: string, hash: string | null): Promise<boolean>;
  /** L'empreinte a été calculée avec des réglages plus faibles que ceux en vigueur (D-028). */
  needsRehash(hash: string): boolean;
  rehash(password: string): Promise<string>;
}
