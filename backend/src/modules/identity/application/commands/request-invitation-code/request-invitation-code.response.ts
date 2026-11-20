/** Identique pour tout numéro, avec ou sans invitation en attente (D-019). */
export interface RequestInvitationCodeResponse {
  readonly maskedPhone: string;
  readonly expiresInSeconds: number;
  readonly resendInSeconds: number;
}
