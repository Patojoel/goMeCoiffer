import type { Health } from '@gomecoiffer/contracts';
import { appApi, fromGateway } from '@/lib/store/api/appApi';

export const healthApi = appApi.injectEndpoints({
  endpoints: (build) => ({
    getHealth: build.query<Health, void>({
      queryFn: fromGateway((deps) => deps.health.check()),
      providesTags: ['Health'],
    }),
  }),
});

export const { useGetHealthQuery } = healthApi;
