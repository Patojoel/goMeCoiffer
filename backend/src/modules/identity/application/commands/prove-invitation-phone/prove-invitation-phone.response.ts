/** Un code refusé est levé en `RefuseAfterCommit` : l'essai raté reste compté. */
export interface ProveInvitationPhoneResponse {
  /** Jeton en clair, à poser dans le cookie de preuve ; ne figure jamais dans un corps de réponse ni en base. */
  readonly token: string;
  readonly provenUntil: string;
}
