/** Un code refusé est levé par le handler en `RefuseAfterCommit` : l'essai de code raté reste compté. */
export interface ResetPasswordResponse {
  readonly userId: string;
  /** Version des identifiants après la réinitialisation, à recopier dans la session neuve. */
  readonly credentialsVersion: number;
  /** Contenu du cookie d'appareil reconnu : un jeton par compte, celui de ce compte renouvelé. */
  readonly deviceTokens: readonly string[];
}
