import { z } from 'zod';
import { CitySchema } from './cities.js';
import { SessionSummarySchema } from './identity.js';

export const SalonTypeSchema = z.enum(['HAIR_SALON', 'BARBER_SHOP', 'BEAUTY', 'MIXED'], {
  error: "Choisissez le type d'activité du salon.",
});
export type SalonType = z.infer<typeof SalonTypeSchema>;

/** Numéro camerounais de 9 chiffres commençant par 6 ou 2, avec ou sans +237 ; espaces, points et tirets acceptés. */
const SalonPhoneInput = z
  .string()
  .trim()
  .refine((value) => /^(\+?237)?[62]\d{8}$/.test(value.replace(/[\s.-]/g, '')), {
    error: 'Saisissez un numéro camerounais de 9 chiffres, par exemple 6 77 12 34 56.',
  });

/** UC-004 — POST /api/salon/organizations : créer son organisation et son premier salon (D-035, D-036). */
export const CreateOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Le nom du salon compte au moins 2 caractères.')
      .max(60, 'Le nom du salon ne peut pas dépasser 60 caractères.'),
    type: SalonTypeSchema,
    city: CitySchema,
    district: z
      .string()
      .trim()
      .min(2, 'Indiquez le quartier (2 caractères au moins).')
      .max(60, 'Le quartier ne peut pas dépasser 60 caractères.'),
    landmark: z
      .string()
      .trim()
      .min(5, 'Indiquez un point de repère (5 caractères au moins).')
      .max(160, 'Le point de repère ne peut pas dépasser 160 caractères.'),
    phone: SalonPhoneInput,
  })
  .strict();
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;

/** Réponse 201 : la session vient d'être régénérée (D-037), le nouveau salon est le salon actif. */
export const OrganizationCreatedSchema = z.object({
  organizationId: z.uuid(),
  salonId: z.uuid(),
  csrfToken: z.string().min(1),
  session: SessionSummarySchema,
});
export type OrganizationCreated = z.infer<typeof OrganizationCreatedSchema>;

/** UC-005 — POST /api/salon/session/active-salon : ouvrir ou changer de salon actif (D-039). */
export const SelectActiveSalonSchema = z.object({ salonId: z.uuid('Salon inconnu.') }).strict();
export type SelectActiveSalon = z.infer<typeof SelectActiveSalonSchema>;

/** Réponse 200 : la session vient d'être régénérée, l'ancien jeton CSRF ne vaut plus. */
export const ActiveSalonSelectedSchema = z.object({
  csrfToken: z.string().min(1),
  session: SessionSummarySchema,
});
export type ActiveSalonSelected = z.infer<typeof ActiveSalonSelectedSchema>;
