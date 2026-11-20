export const USER_SESSIONS_REVOKER = Symbol('USER_SESSIONS_REVOKER');

/**
 * Port vers `identity` : incrémente `users.credentials_version` et détruit les sessions actives de l'utilisateur,
 * dans la transaction en cours (RG-012-08, D-031). Ne révoque pas les appareils reconnus (`known_devices`).
 */
export interface UserSessionsRevoker {
  revokeAllSessionsOf(userId: string): Promise<void>;
}

