export interface VerifyClientCodeResponse {
  readonly userId: string;
  readonly credentialsVersion: number;
  readonly maskedPhone: string;
}
