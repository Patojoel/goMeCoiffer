/** Un refus est levé par le handler en `RefuseAfterCommit` : l'essai reste compté. */
export interface SignInResponse {
  readonly userId: string;
  /** Version des identifiants lue avec le compte, à recopier dans la session : la garantie des sessions fermées. */
  readonly credentialsVersion: number;
  /** Contenu du cookie d'appareil reconnu : un jeton par compte, celui de ce compte renouvelé. */
  readonly deviceTokens: readonly string[];
}
