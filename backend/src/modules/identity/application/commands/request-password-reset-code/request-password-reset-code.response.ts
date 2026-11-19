/** Identique pour un compte du personnel, un compte client léger et un numéro sans compte (D-019). */
export interface RequestPasswordResetCodeResponse {
  readonly maskedPhone: string;
  readonly expiresInSeconds: number;
  readonly resendInSeconds: number;
}
