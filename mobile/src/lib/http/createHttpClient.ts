import type { HttpClient, TokenStorage } from '@gomecoiffer/client-core';
import { localCookieSession } from '../config/env';
import { WebHttpClient } from './WebHttpClient';
import { MobileHttpClient } from './MobileHttpClient';

export type CreateHttpClientOptions = {
  readonly baseUrl: string;
  readonly storage: TokenStorage;
};

export function createHttpClient({ baseUrl, storage }: CreateHttpClientOptions): HttpClient {
  if (localCookieSession) return new WebHttpClient({ baseUrl });
  return new MobileHttpClient({ baseUrl, storage });
}
