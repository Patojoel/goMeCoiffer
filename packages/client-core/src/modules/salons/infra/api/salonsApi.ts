import type {
  ActiveSalonSelected,
  AddSalonToOrganization,
  CreateOrganization,
  OrganizationCreated,
  SalonAdded,
  SelectActiveSalon,
} from '@gomecoiffer/contracts';
import { sessionStarted, sessionStateFromSummary } from '../../../../rbac/sessionSlice.js';
import { appApi, fromGateway } from '../../../../store/api/appApi.js';

export const salonsApi = appApi.injectEndpoints({
  endpoints: (build) => ({
    createOrganization: build.mutation<OrganizationCreated, CreateOrganization>({
      queryFn: fromGateway((deps, input) => deps.salons.createOrganization(input)),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(sessionStarted(sessionStateFromSummary(data.session)));
        } catch {
          // Error handled by caller.
        }
      },
    }),
    addSalon: build.mutation<SalonAdded, AddSalonToOrganization>({
      queryFn: fromGateway((deps, input) => deps.salons.addSalon(input)),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(sessionStarted(sessionStateFromSummary(data.session)));
        } catch {
          // Error handled by caller.
        }
      },
    }),
    selectActiveSalon: build.mutation<ActiveSalonSelected, SelectActiveSalon>({
      queryFn: fromGateway((deps, input) => deps.salons.selectActiveSalon(input)),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(sessionStarted(sessionStateFromSummary(data.session)));
        } catch {
          // Error handled by caller.
        }
      },
    }),
  }),
});

export const {
  useCreateOrganizationMutation,
  useAddSalonMutation,
  useSelectActiveSalonMutation,
} = salonsApi;
