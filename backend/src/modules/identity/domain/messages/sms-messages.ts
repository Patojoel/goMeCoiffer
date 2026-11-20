import { OTP_LIFETIME_SECONDS } from '../aggregates/otp-challenge.js';

/** Textes des SMS (UC-001 Q8) : ni nom, ni lien cliquable, pour ne pas ressembler à un hameçonnage. */
export const SmsMessages = {
  signUpCode: (code: string) =>
    `GoMeCoiffer : votre code est ${code}. Il expire dans ${OTP_LIFETIME_SECONDS / 60} minutes. Ne le communiquez à personne.`,
  passwordResetCode: (code: string) =>
    `GoMeCoiffer : votre code pour changer de mot de passe est ${code}. Il expire dans ${OTP_LIFETIME_SECONDS / 60} minutes. Ne le communiquez à personne.`,
  invitationCode: (code: string) =>
    `GoMeCoiffer : votre code pour rejoindre une équipe est ${code}. Il expire dans ${OTP_LIFETIME_SECONDS / 60} minutes. Ne le communiquez à personne.`,
  clientLoginCode: (code: string) =>
    `GoMeCoiffer : votre code pour retrouver vos réservations est ${code}. Il expire dans ${OTP_LIFETIME_SECONDS / 60} minutes. Ne le communiquez à personne.`,
  accountAlreadyExists: () =>
    'GoMeCoiffer : un compte existe déjà pour ce numéro. Connectez-vous ou utilisez « Mot de passe oublié ».',
};
