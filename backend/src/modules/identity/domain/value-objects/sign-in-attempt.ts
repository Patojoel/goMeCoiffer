/** Un essai de connexion tel que l'historique le garde : numéro normalisé, adresse réseau, issue. */
export interface SignInAttempt {
  readonly phone: string;
  readonly networkAddress: string;
  readonly at: Date;
  readonly succeeded: boolean;
  /** Fait depuis un appareil reconnu : ses échecs ne comptent pas contre le numéro ni l'adresse (D-025). */
  readonly fromKnownDevice: boolean;
  /**
   * Marque posée par une réinitialisation de mot de passe (UC-003) : les échecs du numéro antérieurs ne comptent
   * plus (D-025). Une marque est une réussite, jamais un échec : elle ne compte pas contre l'adresse réseau.
   */
  readonly passwordReset?: boolean;
}
