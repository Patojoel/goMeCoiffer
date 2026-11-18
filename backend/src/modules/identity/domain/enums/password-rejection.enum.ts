/** Raisons de refus d'un nouveau mot de passe (D-020). */
export const PasswordRejection = {
  TOO_SHORT: 'TOO_SHORT',
  TOO_LONG: 'TOO_LONG',
  TOO_COMMON: 'TOO_COMMON',
  CONTAINS_PHONE: 'CONTAINS_PHONE',
} as const;
export type PasswordRejection = (typeof PasswordRejection)[keyof typeof PasswordRejection];
