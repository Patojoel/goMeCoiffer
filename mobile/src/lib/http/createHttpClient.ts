import type { HttpClient, TokenStorage } from '@gomecoiffer/client-core';
import { MobileHttpClient } from './MobileHttpClient';

export type CreateHttpClientOptions = {
  readonly baseUrl: string;
  readonly storage: TokenStorage;
};

export function createHttpClient({ baseUrl, storage }: CreateHttpClientOptions): HttpClient {
  return new MobileHttpClient({ baseUrl, storage });
}
