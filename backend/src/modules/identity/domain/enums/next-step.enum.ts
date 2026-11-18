/** Où conduire l'utilisateur après la connexion (D-027). Valeurs = contrat `NextStepSchema`. */
export const NextStep = {
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  OPEN_SALON: 'OPEN_SALON',
  CHOOSE_SALON: 'CHOOSE_SALON',
  CREATE_ORGANIZATION: 'CREATE_ORGANIZATION',
} as const;
export type NextStep = (typeof NextStep)[keyof typeof NextStep];
