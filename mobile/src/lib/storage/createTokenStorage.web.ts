import type { TokenStorage } from '@gomecoiffer/client-core';

/** Web s'appuie sur des cookies HttpOnly côté API : aucun jeton stocké côté client. */
export function createTokenStorage(): TokenStorage {
  return {
    getSessionToken: () => Promise.resolve(null),
    setSessionToken: () => Promise.resolve(),
    clearSessionToken: () => Promise.resolve(),
    getDeviceToken: () => Promise.resolve(null),
    setDeviceToken: () => Promise.resolve(),
  };
}
