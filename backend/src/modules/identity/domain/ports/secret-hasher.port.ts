import type { SecretVerifier } from './secret-verifier.port.js';

export const SECRET_HASHER = Symbol('SECRET_HASHER');
/** Empreinte des codes SMS : un code n'est jamais stocké en clair. */
export interface SecretHasher extends SecretVerifier {
  hash(secret: string): string;
}
