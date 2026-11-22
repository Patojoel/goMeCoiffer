import {
  SessionSummarySchema,
  SignUpCodeSentSchema,
  SignedInSchema,
  SignedOutSchema,
  SignedUpSchema,
  type ConfirmSignUp,
  type RequestPasswordResetCode,
  type RequestSignUpCode,
  type ResetPassword,
  type SessionSummary,
  type SignIn,
  type SignUpCodeSent,
  type SignedIn,
  type SignedOut,
  type SignedUp,
} from '@gomecoiffer/contracts';
import type { HttpClient } from '../../../../http/HttpClient.js';
import type { AuthGateway } from '../../models/gateway/AuthGateway.js';
import { AUTH_API_ROUTES } from '../api-routes/AuthApiRoutes.js';

export class AuthHttpGateway implements AuthGateway {
  constructor(private readonly http: HttpClient) {}

  getSession(): Promise<SessionSummary> {
    return this.http.get(AUTH_API_ROUTES.session, SessionSummarySchema);
  }

  signIn(input: SignIn): Promise<SignedIn> {
    return this.http.post(AUTH_API_ROUTES.signIn, input, SignedInSchema);
  }

  signOut(): Promise<SignedOut> {
    return this.http.post(AUTH_API_ROUTES.signOut, undefined, SignedOutSchema);
  }

  requestSignUpCode(input: RequestSignUpCode): Promise<SignUpCodeSent> {
    return this.http.post(AUTH_API_ROUTES.requestSignUpCode, input, SignUpCodeSentSchema);
  }

  confirmSignUp(input: ConfirmSignUp): Promise<SignedUp> {
    return this.http.post(AUTH_API_ROUTES.confirmSignUp, input, SignedUpSchema);
  }

  requestPasswordResetCode(input: RequestPasswordResetCode): Promise<SignUpCodeSent> {
    return this.http.post(AUTH_API_ROUTES.requestPasswordResetCode, input, SignUpCodeSentSchema);
  }

  resetPassword(input: ResetPassword): Promise<SignedIn> {
    return this.http.post(AUTH_API_ROUTES.resetPassword, input, SignedInSchema);
  }
}
