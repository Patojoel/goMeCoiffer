/** Un essai de connexion tel que l'historique le garde : numéro normalisé, adresse réseau, issue. */
export interface SignInAttempt {
  readonly phone: string;
  readonly networkAddress: string;
  readonly at: Date;
  readonly succeeded: boolean;
  /** Fait depuis un appareil reconnu : ses échecs ne comptent pas contre le numéro ni l'adresse (D-025). */
  readonly fromKnownDevice: boolean;
}
