import type {
  ClientSessionSummary,
  ClientSignedIn,
  RequestClientCode,
  SignUpCodeSent,
  VerifyClientCode,
} from '@gomecoiffer/contracts';

export interface ClientSpaceGateway {
  requestCode(input: RequestClientCode): Promise<SignUpCodeSent>;
  verifyCode(input: VerifyClientCode): Promise<ClientSignedIn>;
  getSession(): Promise<ClientSessionSummary>;
}
