import { z } from 'zod';
import { CitySchema } from './cities.js';

/** Numéro tel que saisi ; la normalisation (+237…) et la règle camerounaise sont appliquées par l'API. */
const PhoneInput = z.string().trim().min(8).max(25);

/** UC-001 — POST /api/public/sign-up/code : demander un code d'inscription. */
export const RequestSignUpCodeSchema = z
  .object({
    phone: PhoneInput,
    acceptedTerms: z.literal(true, { error: "Acceptez les conditions d'utilisation pour continuer." }),
  })
  .strict();
export type RequestSignUpCode = z.infer<typeof RequestSignUpCodeSchema>;

/** Réponse identique que le numéro soit nouveau, client ou déjà inscrit (D-019). */
export const SignUpCodeSentSchema = z.object({
  maskedPhone: z.string(),
  expiresInSeconds: z.number().int().positive(),
  resendInSeconds: z.number().int().positive(),
});
export type SignUpCodeSent = z.infer<typeof SignUpCodeSentSchema>;

/** UC-001 — POST /api/public/sign-up : confirmer le code et créer (ou compléter) le compte. */
export const ConfirmSignUpSchema = z
  .object({
    phone: PhoneInput,
    code: z.string().regex(/^\d{6}$/, 'Le code reçu par SMS compte 6 chiffres.'),
    name: z
      .string()
      .trim()
      .min(2, 'Indiquez votre nom (2 caractères au moins).')
      .max(80, 'Votre nom ne peut pas dépasser 80 caractères.'),
    email: z.email('Adresse e-mail mal formée.').max(254).optional(),
    password: z.string().min(1).max(128, 'Le mot de passe ne peut pas dépasser 128 caractères.'),
    acceptedTerms: z.literal(true, { error: "Acceptez les conditions d'utilisation pour continuer." }),
  })
  .strict();
export type ConfirmSignUp = z.infer<typeof ConfirmSignUpSchema>;

export const SignedUpSchema = z.object({
  userId: z.uuid(),
  nextStep: z.literal('CREATE_ORGANIZATION'),
  /** Nouveau jeton CSRF : la session vient d'être régénérée, l'ancien jeton ne vaut plus. */
  csrfToken: z.string().min(1),
});
export type SignedUp = z.infer<typeof SignedUpSchema>;

/** UC-002 — POST /api/public/auth/sign-in : se connecter avec son numéro et son mot de passe (D-017). */
export const SignInSchema = z
  .object({
    phone: PhoneInput,
    password: z.string().min(1, 'Saisissez votre mot de passe.').max(128, '128 caractères au plus.'),
  })
  .strict();
export type SignIn = z.infer<typeof SignInSchema>;

/** Où conduire l'utilisateur après la connexion (D-027). */
export const NextStepSchema = z.enum(['PLATFORM_ADMIN', 'OPEN_SALON', 'CHOOSE_SALON', 'CREATE_ORGANIZATION']);
export type NextStep = z.infer<typeof NextStepSchema>;

/** UC-002 — GET /api/salon/session : résumé de la session, sans téléphone ni e-mail. */
export const SessionSummarySchema = z.object({
  user: z.object({ id: z.uuid(), name: z.string() }),
  activeSalonId: z.uuid().nullable(),
  /** Salons où l'utilisateur a une appartenance active, avec ville et quartier (D-040). */
  salons: z.array(
    z.object({ id: z.uuid(), name: z.string(), role: z.string(), city: CitySchema, district: z.string() }),
  ),
  /** Permissions de l'utilisateur dans le salon actif, vide sans salon actif (UC-008 RG-008-11). */
  permissions: z.array(z.string()),
  systemRoles: z.array(z.string()),
  nextStep: NextStepSchema,
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SignedInSchema = z.object({
  /** Nouveau jeton CSRF : la session vient d'être régénérée, l'ancien jeton ne vaut plus. */
  csrfToken: z.string().min(1),
  session: SessionSummarySchema,
});
export type SignedIn = z.infer<typeof SignedInSchema>;

/** UC-002 — POST /api/public/auth/sign-out : même réponse avec ou sans session ouverte. */
export const SignedOutSchema = z.object({ signedOut: z.literal(true) });
export type SignedOut = z.infer<typeof SignedOutSchema>;

/** UC-003 — POST /api/public/auth/password-reset/code : demander un code (réponse `SignUpCodeSent`, identique pour tout numéro). */
export const RequestPasswordResetCodeSchema = z.object({ phone: PhoneInput }).strict();
export type RequestPasswordResetCode = z.infer<typeof RequestPasswordResetCodeSchema>;

/** UC-003 — POST /api/public/auth/password-reset : nouveau mot de passe ; réponse `SignedIn` (connexion automatique, D-031). */
export const ResetPasswordSchema = z
  .object({
    phone: PhoneInput,
    code: z.string().regex(/^\d{6}$/, 'Le code reçu par SMS compte 6 chiffres.'),
    newPassword: z.string().min(1).max(128, 'Le mot de passe ne peut pas dépasser 128 caractères.'),
  })
  .strict();
export type ResetPassword = z.infer<typeof ResetPasswordSchema>;

/** UC-007 — POST /api/public/invitations/code : demander un code pour rejoindre un salon (réponse `SignUpCodeSent`, identique pour tout numéro). */
export const RequestInvitationCodeSchema = z.object({ phone: PhoneInput }).strict();
export type RequestInvitationCode = z.infer<typeof RequestInvitationCodeSchema>;

/** UC-007 — POST /api/public/invitations/phone-proof : prouver le numéro avec le code reçu. */
export const ProveInvitationPhoneSchema = z
  .object({
    phone: PhoneInput,
    code: z.string().regex(/^\d{6}$/, 'Le code reçu par SMS compte 6 chiffres.'),
  })
  .strict();
export type ProveInvitationPhone = z.infer<typeof ProveInvitationPhoneSchema>;

/** Le jeton de preuve ne voyage que dans un cookie HttpOnly ; le corps ne dit que jusqu'à quand il vaut. */
export const InvitationPhoneProvenSchema = z.object({ provenUntil: z.iso.datetime() });
export type InvitationPhoneProven = z.infer<typeof InvitationPhoneProvenSchema>;

/** UC-009 — POST /api/public/client/code : demander un code SMS pour retrouver ses réservations (RG-009-01). */
export const RequestClientCodeSchema = z
  .object({
    phone: PhoneInput,
    termsAccepted: z.literal(true, { error: "Acceptez les conditions d'utilisation pour continuer." }),
  })
  .strict();
export type RequestClientCode = z.infer<typeof RequestClientCodeSchema>;

/** UC-009 — POST /api/public/client/session : vérifier le code SMS et ouvrir la session client (RG-009-05, RG-009-07). */
export const VerifyClientCodeSchema = z
  .object({
    phone: PhoneInput,
    code: z.string().regex(/^\d{6}$/, 'Le code reçu par SMS compte 6 chiffres.'),
  })
  .strict();
export type VerifyClientCode = z.infer<typeof VerifyClientCodeSchema>;

/** UC-009 — GET /api/client/session : résumé de la session dans l'espace client (RG-009-10). */
export const ClientSessionSummarySchema = z.object({
  kind: z.enum(['CLIENT', 'STAFF']),
  maskedPhone: z.string(),
});
export type ClientSessionSummary = z.infer<typeof ClientSessionSummarySchema>;

/** Réponse 200 de POST /api/public/client/session : identique que le compte soit créé ou existant (RG-009-10). */
export const ClientSignedInSchema = z.object({
  csrfToken: z.string().min(1),
  session: z.object({
    kind: z.literal('CLIENT'),
    maskedPhone: z.string(),
  }),
});
export type ClientSignedIn = z.infer<typeof ClientSignedInSchema>;
