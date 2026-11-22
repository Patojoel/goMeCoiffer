import type { HttpClient } from '@gomecoiffer/client-core';
import type { CreateHttpClientOptions } from './createHttpClient';
import { WebHttpClient } from './WebHttpClient';

export type { CreateHttpClientOptions };

export function createHttpClient({ baseUrl }: CreateHttpClientOptions): HttpClient {
  return new WebHttpClient({ baseUrl });
}
