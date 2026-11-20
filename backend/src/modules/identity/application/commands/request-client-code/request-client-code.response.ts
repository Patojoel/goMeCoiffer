export interface RequestClientCodeResponse {
  readonly maskedPhone: string;
  readonly expiresInSeconds: number;
  readonly resendInSeconds: number;
}
