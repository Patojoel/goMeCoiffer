/** Un même défi SMS sert l'inscription, le mot de passe oublié, l'invitation et la vérification client. */
export const OtpPurpose = {
  SIGN_UP: 'SIGN_UP',
  PASSWORD_RESET: 'PASSWORD_RESET',
  INVITATION: 'INVITATION',
  CLIENT_LOGIN: 'CLIENT_LOGIN',
} as const;
export type OtpPurpose = (typeof OtpPurpose)[keyof typeof OtpPurpose];
