import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { HttpError } from '@/lib/http/HttpClient';
import type { AppDependencies } from '../dependencies/AppDependencies';

/** Étiquettes de lecture ; chaque module ajoute la sienne ici. */
export const API_TAGS = ['Health'] as const;

/** Erreur sérialisable stockée dans le cache RTK Query (jamais une instance d'`Error`). */
export type QueryError = { status: number; code: string; message: string };

export const toQueryError = (e: unknown): QueryError =>
  e instanceof HttpError
    ? { status: e.status, code: e.code, message: e.message }
    : { status: 0, code: 'UNKNOWN', message: e instanceof Error ? e.message : 'Erreur inconnue' };

/** Une seule api ; pas de `fetchBaseQuery` : les endpoints appellent les gateways injectés (`extra`). */
export const appApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<QueryError>(),
  tagTypes: API_TAGS,
  endpoints: () => ({}),
});

type QueryFnApi = { extra: unknown };

/** Construit un `queryFn` qui appelle un gateway du conteneur injecté. */
export const fromGateway =
  <Arg, Result>(call: (deps: AppDependencies, arg: Arg) => Promise<Result>) =>
  async (arg: Arg, api: QueryFnApi) => {
    try {
      return { data: await call(api.extra as AppDependencies, arg) };
    } catch (e) {
      return { error: toQueryError(e) };
    }
  };

/** Vide tout le cache de lecture : déconnexion, changement de salon actif. */
export const purgeApiCache = () => appApi.util.resetApiState();

/** Relit tout ce qui est affiché : reconnexion du flux temps réel. */
export const invalidateAllReads = () => appApi.util.invalidateTags([...API_TAGS]);
