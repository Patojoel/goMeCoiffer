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

export interface AuthGateway {
  getSession(): Promise<SessionSummary>;
  signIn(input: SignIn): Promise<SignedIn>;
  signOut(): Promise<SignedOut>;
  requestSignUpCode(input: RequestSignUpCode): Promise<SignUpCodeSent>;
  confirmSignUp(input: ConfirmSignUp): Promise<SignedUp>;
  requestPasswordResetCode(input: RequestPasswordResetCode): Promise<SignUpCodeSent>;
  resetPassword(input: ResetPassword): Promise<SignedIn>;
}
