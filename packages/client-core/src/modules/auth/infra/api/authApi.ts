import type {
  ConfirmSignUp,
  RequestPasswordResetCode,
  RequestSignUpCode,
  ResetPassword,
  SessionSummary,
  SignIn,
  SignUpCodeSent,
  SignedIn,
  SignedOut,
  SignedUp,
} from '@gomecoiffer/contracts';
import { sessionCleared, sessionStarted, sessionStateFromSummary } from '../../../../rbac/sessionSlice.js';
import { appApi, fromGateway } from '../../../../store/api/appApi.js';

export const authApi = appApi.injectEndpoints({
  endpoints: (build) => ({
    getStaffSession: build.query<SessionSummary, void>({
      queryFn: fromGateway((deps) => deps.auth.getSession()),
      providesTags: ['Session'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(sessionStarted(sessionStateFromSummary(data)));
        } catch {
          // 401/network errors are surfaced by the query hook or HttpClient unauthorized listener.
        }
      },
    }),
    signIn: build.mutation<SignedIn, SignIn>({
      queryFn: fromGateway((deps, input) => deps.auth.signIn(input)),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(sessionStarted(sessionStateFromSummary(data.session)));
        } catch {
          // Error returned to caller.
        }
      },
    }),
    signOut: build.mutation<SignedOut, void>({
      queryFn: fromGateway((deps) => deps.auth.signOut()),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch {
          // Session must be cleared locally even when sign-out fails (UC-013 RG-013-12).
        } finally {
          dispatch(sessionCleared());
        }
      },
    }),
    requestSignUpCode: build.mutation<SignUpCodeSent, RequestSignUpCode>({
      queryFn: fromGateway((deps, input) => deps.auth.requestSignUpCode(input)),
    }),
    confirmSignUp: build.mutation<SignedUp, ConfirmSignUp>({
      queryFn: fromGateway((deps, input) => deps.auth.confirmSignUp(input)),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(
            sessionStarted({
              userId: data.userId,
              kind: 'STAFF',
              activeSalonId: null,
              permissions: [],
              systemRoles: [],
              maskedPhone: null,
              salons: [],
              nextStep: data.nextStep,
            }),
          );
        } catch {
          // Error returned to caller.
        }
      },
    }),
    requestPasswordResetCode: build.mutation<SignUpCodeSent, RequestPasswordResetCode>({
      queryFn: fromGateway((deps, input) => deps.auth.requestPasswordResetCode(input)),
    }),
    resetPassword: build.mutation<SignedIn, ResetPassword>({
      queryFn: fromGateway((deps, input) => deps.auth.resetPassword(input)),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(sessionStarted(sessionStateFromSummary(data.session)));
        } catch {
          // Error returned to caller.
        }
      },
    }),
  }),
});

export const {
  useGetStaffSessionQuery,
  useSignInMutation,
  useSignOutMutation,
  useRequestSignUpCodeMutation,
  useConfirmSignUpMutation,
  useRequestPasswordResetCodeMutation,
  useResetPasswordMutation,
} = authApi;
