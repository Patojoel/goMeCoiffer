import * as SecureStore from 'expo-secure-store';
import type { TokenStorage } from '@gomecoiffer/client-core';

const SESSION_TOKEN_KEY = 'gomecoiffer.session_token';
const DEVICE_TOKEN_KEY = 'gomecoiffer.device_token';

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export type SecureStoreAdapter = {
  readonly getItemAsync: (
    key: string,
    options?: SecureStore.SecureStoreOptions,
  ) => Promise<string | null>;
  readonly setItemAsync: (
    key: string,
    value: string,
    options?: SecureStore.SecureStoreOptions,
  ) => Promise<void>;
  readonly deleteItemAsync: (
    key: string,
    options?: SecureStore.SecureStoreOptions,
  ) => Promise<void>;
};

async function readSecureItem(
  secureStore: SecureStoreAdapter,
  key: string,
): Promise<string | null> {
  try {
    return await secureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
  } catch {
    // Clé corrompue ou verrouillage réinitialisé : purger l'entrée illisible plutôt que bloquer l'app.
    await secureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS).catch(() => undefined);
    return null;
  }
}

export function createTokenStorage(secureStore: SecureStoreAdapter = SecureStore): TokenStorage {
  let cachedSessionToken: string | null | undefined = undefined;
  let queue: Promise<unknown> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = queue.then(operation, operation);
    queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  return {
    getSessionToken: () =>
      enqueue(async () => {
        if (cachedSessionToken !== undefined) return cachedSessionToken;
        const stored = await readSecureItem(secureStore, SESSION_TOKEN_KEY);
        cachedSessionToken = stored;
        return stored;
      }),
    setSessionToken: (token) =>
      enqueue(async () => {
        await secureStore.setItemAsync(SESSION_TOKEN_KEY, token, SECURE_STORE_OPTIONS);
        cachedSessionToken = token;
      }),
    clearSessionToken: () =>
      enqueue(async () => {
        await secureStore.deleteItemAsync(SESSION_TOKEN_KEY, SECURE_STORE_OPTIONS);
        cachedSessionToken = null;
      }),
    getDeviceToken: () => enqueue(() => readSecureItem(secureStore, DEVICE_TOKEN_KEY)),
    setDeviceToken: (token) =>
      enqueue(() => secureStore.setItemAsync(DEVICE_TOKEN_KEY, token, SECURE_STORE_OPTIONS)),
  };
}
