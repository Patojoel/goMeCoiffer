import { z } from 'zod';

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
