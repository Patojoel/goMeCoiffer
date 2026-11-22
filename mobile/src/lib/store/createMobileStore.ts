import {
  createCoreStore,
  sessionExpired,
  type CoreStore,
  type HttpClient,
  type TokenStorage,
} from '@gomecoiffer/client-core';
import { env } from '../config/env';
import { createHttpClient } from '../http/createHttpClient';
import { createTokenStorage } from '../storage/createTokenStorage';
import { createDependencies } from './dependencies/dependencies';

export type CreateMobileStoreOptions = {
  readonly baseUrl?: string;
  readonly storage?: TokenStorage;
  readonly http?: HttpClient;
};

export function createMobileStore(options: CreateMobileStoreOptions = {}): CoreStore {
  const storage = options.storage ?? createTokenStorage();
  const http = options.http ?? createHttpClient({ baseUrl: options.baseUrl ?? env.apiBaseUrl, storage });
  const store = createCoreStore(createDependencies(http));

  http.onUnauthorized(() => {
    store.dispatch(sessionExpired());
  });

  return store;
}
