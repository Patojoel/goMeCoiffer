export const COMMON_PASSWORDS = Symbol('COMMON_PASSWORDS');
/** Liste des mots de passe courants, tenue par l'infrastructure (fichier de données). */
export interface CommonPasswords {
  includes(candidate: string): boolean;
}
