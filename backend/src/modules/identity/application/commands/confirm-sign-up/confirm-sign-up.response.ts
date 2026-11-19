/** Après l'inscription, le propriétaire crée son organisation (PRD §7, étape 2). */
export type SignUpNextStep = 'CREATE_ORGANIZATION';

/** Un code refusé est levé par le handler en `RefuseAfterCommit` : l'essai raté reste compté. */
export interface ConfirmSignUpResponse {
  readonly userId: string;
  /** Version des identifiants du compte, à recopier dans la session. */
  readonly credentialsVersion: number;
  readonly outcome: 'CREATED' | 'COMPLETED';
  readonly nextStep: SignUpNextStep;
}
