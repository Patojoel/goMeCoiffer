import type {
  InvitationAccepted,
  InvitationPhoneProven,
  InvitationsForProvenPhone,
  ProveInvitationPhone,
  RequestInvitationCode,
  SignUpCodeSent,
} from '@gomecoiffer/contracts';
import { sessionStarted, sessionStateFromSummary } from '../../../../rbac/sessionSlice.js';
import { appApi, fromGateway } from '../../../../store/api/appApi.js';
import type { AcceptInvitationWire } from '../../models/gateway/JoinSalonGateway.js';

export const joinSalonApi = appApi.injectEndpoints({
  endpoints: (build) => ({
    requestInvitationCode: build.mutation<SignUpCodeSent, RequestInvitationCode>({
      queryFn: fromGateway((deps, input) => deps.joinSalon.requestCode(input)),
    }),
    proveInvitationPhone: build.mutation<InvitationPhoneProven, ProveInvitationPhone>({
      queryFn: fromGateway((deps, input) => deps.joinSalon.provePhone(input)),
      invalidatesTags: ['ProvenInvitations'],
    }),
    listProvenInvitations: build.query<InvitationsForProvenPhone, void>({
      queryFn: fromGateway((deps) => deps.joinSalon.listProvenInvitations()),
      providesTags: ['ProvenInvitations'],
    }),
    acceptInvitation: build.mutation<
      InvitationAccepted,
      { readonly invitationId: string; readonly body: AcceptInvitationWire }
    >({
      queryFn: fromGateway((deps, arg) => deps.joinSalon.acceptInvitation(arg.invitationId, arg.body)),
      invalidatesTags: ['ProvenInvitations'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.outcome === 'SIGNED_IN') {
            dispatch(sessionStarted(sessionStateFromSummary(data.session)));
          }
        } catch {
          // Error handled by caller.
        }
      },
    }),
  }),
});

export const {
  useRequestInvitationCodeMutation,
  useProveInvitationPhoneMutation,
  useListProvenInvitationsQuery,
  useAcceptInvitationMutation,
} = joinSalonApi;
