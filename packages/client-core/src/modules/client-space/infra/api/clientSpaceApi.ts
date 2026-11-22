import type {
  ClientSessionSummary,
  ClientSignedIn,
  RequestClientCode,
  SignUpCodeSent,
  VerifyClientCode,
} from '@gomecoiffer/contracts';
import { clientSessionStateFrom, sessionStarted } from '../../../../rbac/sessionSlice.js';
import { appApi, fromGateway } from '../../../../store/api/appApi.js';

export const clientSpaceApi = appApi.injectEndpoints({
  endpoints: (build) => ({
    requestClientCode: build.mutation<SignUpCodeSent, RequestClientCode>({
      queryFn: fromGateway((deps, input) => deps.clientSpace.requestCode(input)),
    }),
    verifyClientCode: build.mutation<ClientSignedIn, VerifyClientCode>({
      queryFn: fromGateway((deps, input) => deps.clientSpace.verifyCode(input)),
      invalidatesTags: ['ClientSession'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(sessionStarted(clientSessionStateFrom(data.session.maskedPhone)));
        } catch {
          // Error handled by caller.
        }
      },
    }),
    getClientSession: build.query<ClientSessionSummary, void>({
      queryFn: fromGateway((deps) => deps.clientSpace.getSession()),
      providesTags: ['ClientSession'],
    }),
  }),
});

export const {
  useRequestClientCodeMutation,
  useVerifyClientCodeMutation,
  useGetClientSessionQuery,
} = clientSpaceApi;
