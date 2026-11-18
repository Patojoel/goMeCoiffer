/** Réponse identique que le numéro soit inscrit ou non (D-019) : rien n'y révèle l'existence d'un compte. */
export interface RequestSignUpCodeResponse {
  readonly maskedPhone: string;
  readonly expiresInSeconds: number;
  readonly resendInSeconds: number;
}
