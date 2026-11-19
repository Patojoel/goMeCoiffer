export const USER_SESSIONS = Symbol('USER_SESSIONS');
export interface UserSessions {
  /**
   * Supprime toutes les sessions ouvertes de cet utilisateur, dans la transaction de la commande ; renvoie leur
   * nombre. Ce n'est qu'un nettoyage : la garantie est la version des identifiants, comparée à chaque requête
   * (une requête en cours réécrit sa session en fin de requête).
   */
  closeAllOf(userId: string): Promise<number>;
}
