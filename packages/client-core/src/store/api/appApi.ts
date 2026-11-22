import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { toApiFailure, type ApiFailure } from '../../http/HttpError.js';
import type { AppDependencies } from '../dependencies/AppDependencies.js';

export const API_TAGS = [
  'Health',
  'Session',
  'ClientSession',
  'Invitations',
  'Team',
  'ProvenInvitations',
  'SalonRoles',
  'PlatformAdmins',
] as const;

export const appApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<ApiFailure>(),
  tagTypes: API_TAGS,
  endpoints: () => ({}),
});

type QueryFnApi = { extra: unknown };

export const fromGateway =
  <Arg, Result>(call: (deps: AppDependencies, arg: Arg) => Promise<Result>) =>
  async (arg: Arg, api: QueryFnApi) => {
    try {
      return { data: await call(api.extra as AppDependencies, arg) };
    } catch (error) {
      return { error: toApiFailure(error) };
    }
  };

export const purgeApiCache = () => appApi.util.resetApiState();

export const invalidateAllReads = () => appApi.util.invalidateTags([...API_TAGS]);
