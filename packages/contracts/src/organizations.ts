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
const SalonDetailsSchema = z
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
export const CreateOrganizationSchema = SalonDetailsSchema.extend({
  organizationName: z.string().trim().min(2).max(60).optional(),
});
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

/** Les quatre rôles de collaborateur ; jamais Propriétaire ni rôle système (D-042). */
export const InvitableSalonRoleSchema = z.enum(['SALON_ADMIN', 'HAIRDRESSER', 'FINANCE_MANAGER', 'PRACTITIONER'], {
  error: 'Choisissez un des rôles proposés.',
});
export type InvitableSalonRole = z.infer<typeof InvitableSalonRoleSchema>;

// oxlint-disable-next-line no-control-regex
const UNSAFE_TEXT_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/**
 * UC-006 — POST /api/salon/invitations : nom, numéro et rôle seulement (D-045). Le numéro est contrôlé par le domaine
 * (422 « Numéro de téléphone camerounais invalide… »), le salon et l'auteur viennent de la session.
 */
export const InviteCollaboratorSchema = z
  .object({
    name: z
      .string()
      .transform((value) => value.replace(UNSAFE_TEXT_CHARS, '').trim().replace(/\s+/g, ' '))
      .pipe(
        z
          .string()
          .min(2, 'Le nom de la personne compte au moins 2 caractères.')
          .max(80, 'Le nom de la personne ne peut pas dépasser 80 caractères.'),
      ),
    phone: z.string().trim().min(1, 'Saisissez le numéro de la personne.').max(30),
    role: InvitableSalonRoleSchema,
  })
  .strict();
export type InviteCollaborator = z.infer<typeof InviteCollaboratorSchema>;

/** Réponse 201 : rien sur le compte éventuel du numéro (D-019). */
export const CollaboratorInvitedSchema = z.object({
  invitationId: z.uuid(),
  name: z.string(),
  phone: z.string(),
  role: InvitableSalonRoleSchema,
  expiresAt: z.iso.datetime(),
});
export type CollaboratorInvited = z.infer<typeof CollaboratorInvitedSchema>;

/** Réponse 200 de POST /api/salon/invitations/:id/cancellation. */
export const InvitationCancelledSchema = z.object({
  invitationId: z.uuid(),
  status: z.literal('CANCELLED'),
});
export type InvitationCancelled = z.infer<typeof InvitationCancelledSchema>;

/**
 * Réponse de GET /api/salon/invitations : invitations en attente et expirées du salon actif, les plus récentes
 * d'abord. `status` est calculé à l'instant de la lecture (en attente dont l'échéance est passée = `EXPIRED`) ;
 * `name` et `phone` sont `null` une fois effacés, 30 jours après la fin (RG-006-17).
 */
export const SalonInvitationSchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  role: InvitableSalonRoleSchema,
  sentAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  status: z.enum(['PENDING', 'EXPIRED']),
});
export type SalonInvitation = z.infer<typeof SalonInvitationSchema>;
export const SalonInvitationsSchema = z.array(SalonInvitationSchema);
export type SalonInvitations = z.infer<typeof SalonInvitationsSchema>;

/**
 * UC-007 — POST /api/public/invitations/:id/acceptance. Corps vide pour un compte du personnel existant ; sinon nom,
 * mot de passe et conditions, tous les trois (D-047). Toute autre clé est refusée : rôle, salon, numéro, utilisateur.
 * Sortie : `details` vaut `null` quand le corps est vide.
 */
export const AcceptInvitationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Indiquez votre nom (2 caractères au moins).')
      .max(80, 'Votre nom ne peut pas dépasser 80 caractères.')
      .optional(),
    password: z.string().min(1).max(128, 'Le mot de passe ne peut pas dépasser 128 caractères.').optional(),
    termsAccepted: z
      .literal(true, { error: "Acceptez les conditions d'utilisation pour continuer." })
      .optional(),
  })
  .strict()
  .superRefine((body, context) => {
    const given = [body.name, body.password, body.termsAccepted].filter((value) => value !== undefined);
    if (given.length === 0 || given.length === 3) return;
    for (const field of ['name', 'password', 'termsAccepted'] as const)
      if (body[field] === undefined)
        context.addIssue({ code: 'custom', path: [field], message: 'Complétez ce champ pour créer votre compte.' });
  })
  .transform(({ name, password, termsAccepted }) => ({
    details:
      name === undefined || password === undefined || termsAccepted === undefined
        ? null
        : { name, password, termsAccepted },
  }));
export type AcceptInvitation = z.infer<typeof AcceptInvitationSchema>;

/** Réponse 200 : session ouverte ou régénérée dans le salon rejoint, ou invitation à se connecter (RG-007-13). */
export const InvitationAcceptedSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('SIGNED_IN'),
    salonName: z.string(),
    csrfToken: z.string().min(1),
    session: SessionSummarySchema,
  }),
  z.object({ outcome: z.literal('SIGN_IN_REQUIRED'), salonName: z.string() }),
]);
export type InvitationAccepted = z.infer<typeof InvitationAcceptedSchema>;

/**
 * Réponse de GET /api/public/invitations (cookie de preuve) : invitations en attente du numéro prouvé, les plus
 * récentes d'abord. `account` dit ce que l'écran doit demander : `NEW` créer un compte, `TO_COMPLETE` compléter un
 * compte client, `EXISTING` rien. Jamais le nom de la personne qui a invité.
 */
export const InvitationsForProvenPhoneSchema = z.object({
  account: z.enum(['NEW', 'TO_COMPLETE', 'EXISTING']),
  invitations: z.array(
    z.object({
      invitationId: z.uuid(),
      salonName: z.string(),
      city: CitySchema,
      district: z.string(),
      role: InvitableSalonRoleSchema,
      expiresAt: z.iso.datetime(),
      /** Nom saisi par le salon, pour pré-remplir (modifiable) la création du compte. */
      suggestedName: z.string(),
    }),
  ),
});
export type InvitationsForProvenPhone = z.infer<typeof InvitationsForProvenPhoneSchema>;

/** UC-008 — Les quatre rôles de collaborateur dont les permissions sont réglables par salon (RG-008-03). */
export const AdjustableSalonRoleSchema = InvitableSalonRoleSchema;
export type AdjustableSalonRole = z.infer<typeof AdjustableSalonRoleSchema>;

/** Les 16 permissions ajustables du catalogue du salon (RG-008-02). `roles:administer` est réservé au propriétaire. */
export const ADJUSTABLE_PERMISSIONS = [
  'dashboard:view',
  'bookings:view-own',
  'bookings:view-all',
  'bookings:manage',
  'availability:edit-own',
  'availability:manage-team',
  'services:view',
  'services:manage',
  'staff:view',
  'staff:invite',
  'staff:manage',
  'finances:view',
  'finances:record-payment',
  'finances:export',
  'salon-settings:view',
  'salon-settings:edit',
] as const;
export const AdjustablePermissionSchema = z.enum(ADJUSTABLE_PERMISSIONS, {
  error: 'Choisissez une permission ajustable du catalogue.',
});
export type AdjustablePermission = z.infer<typeof AdjustablePermissionSchema>;

/** Les 17 permissions du salon (RG-008-02). */
export const SALON_PERMISSIONS = [...ADJUSTABLE_PERMISSIONS, 'roles:administer'] as const;
export const SalonPermissionSchema = z.enum(SALON_PERMISSIONS);
export type SalonPermission = z.infer<typeof SalonPermissionSchema>;

/** Droits réservés au propriétaire, jamais donnés à un autre rôle (RG-008-04). */
export const RESERVED_OWNER_RIGHTS = [
  'roles:administer',
  'organization:manage-salons',
  'subscription:manage',
  'payout-accounts:manage',
] as const;
export const ReservedOwnerRightSchema = z.enum(RESERVED_OWNER_RIGHTS);
export type ReservedOwnerRight = z.infer<typeof ReservedOwnerRightSchema>;

/** Permissions par défaut des quatre rôles de collaborateur (RG-008-05, D-051). */
export const DEFAULT_ROLE_PERMISSIONS: Readonly<
  Record<AdjustableSalonRole, readonly AdjustablePermission[]>
> = {
  SALON_ADMIN: [
    'dashboard:view',
    'bookings:view-own',
    'bookings:view-all',
    'bookings:manage',
    'availability:edit-own',
    'availability:manage-team',
    'services:view',
    'services:manage',
    'staff:view',
    'staff:invite',
    'staff:manage',
    'salon-settings:view',
  ],
  HAIRDRESSER: ['bookings:view-own', 'availability:edit-own'],
  FINANCE_MANAGER: [
    'dashboard:view',
    'bookings:view-all',
    'finances:view',
    'finances:record-payment',
    'finances:export',
  ],
  PRACTITIONER: ['bookings:view-own', 'availability:edit-own'],
};

/** UC-008 — PUT /api/salon/roles/:role/permissions : remplacer les permissions d'un rôle dans le salon actif. */
export const AdjustRolePermissionsSchema = z
  .object({
    permissions: z
      .array(AdjustablePermissionSchema)
      .max(ADJUSTABLE_PERMISSIONS.length)
      .refine((items) => new Set(items).size === items.length, {
        error: 'Chaque permission ne peut apparaître qu’une seule fois.',
      }),
    version: z.number().int().nonnegative('Indiquez la version consultée.'),
    resetToDefault: z.boolean().optional(),
  })
  .strict();
export type AdjustRolePermissions = z.infer<typeof AdjustRolePermissionsSchema>;

/** Réponse 200 de PUT /api/salon/roles/:role/permissions. */
export const RolePermissionsAdjustedSchema = z.object({
  role: AdjustableSalonRoleSchema,
  permissions: z.array(AdjustablePermissionSchema),
  version: z.number().int().nonnegative(),
});
export type RolePermissionsAdjusted = z.infer<typeof RolePermissionsAdjustedSchema>;

/** Réponse 200 de GET /api/salon/roles (RG-008-17). */
export const SalonRolesSchema = z.object({
  owner: z.object({
    permissions: z.array(SalonPermissionSchema),
    reservedRights: z.array(ReservedOwnerRightSchema),
    members: z.number().int().nonnegative(),
  }),
  roles: z.array(
    z.object({
      role: AdjustableSalonRoleSchema,
      permissions: z.array(AdjustablePermissionSchema),
      defaultPermissions: z.array(AdjustablePermissionSchema),
      isDefault: z.boolean(),
      members: z.number().int().nonnegative(),
      version: z.number().int().nonnegative(),
    }),
  ),
});
export type SalonRoles = z.infer<typeof SalonRolesSchema>;

/** UC-010 — POST /api/salon/salons : ajouter un salon à son organisation (mêmes 6 champs que UC-004, D-036, D-056). */
export const AddSalonToOrganizationSchema = SalonDetailsSchema;
export type AddSalonToOrganization = z.infer<typeof AddSalonToOrganizationSchema>;

/** Réponse 201 de POST /api/salon/salons : session régénérée sur le nouveau salon actif (D-056). */
export const SalonAddedSchema = OrganizationCreatedSchema;
export type SalonAdded = z.infer<typeof SalonAddedSchema>;

/** UC-011 — GET /api/salon/team : membres actifs du salon actif, Propriétaire en premier puis par nom, sans numéro (D-057). */
export const SalonRoleSchema = z.enum([
  'OWNER',
  'SALON_ADMIN',
  'HAIRDRESSER',
  'FINANCE_MANAGER',
  'PRACTITIONER',
]);
export type SalonRoleContract = z.infer<typeof SalonRoleSchema>;

export const SalonTeamMemberSchema = z.object({
  membershipId: z.uuid(),
  name: z.string(),
  role: SalonRoleSchema,
  joinedAt: z.iso.datetime(),
  isCurrentUser: z.boolean(),
  version: z.number().int().nonnegative(),
});
export type SalonTeamMember = z.infer<typeof SalonTeamMemberSchema>;

export const SalonTeamSchema = z.object({
  members: z.array(SalonTeamMemberSchema),
});
export type SalonTeam = z.infer<typeof SalonTeamSchema>;

/** UC-011 — PUT /api/salon/team/:id/role : changer le rôle d'un collaborateur dans le salon actif. */
export const ChangeCollaboratorRoleSchema = z
  .object({
    role: AdjustableSalonRoleSchema,
    version: z.number().int().nonnegative('Indiquez la version consultée.'),
  })
  .strict();
export type ChangeCollaboratorRole = z.infer<typeof ChangeCollaboratorRoleSchema>;

export const CollaboratorRoleChangedSchema = z.object({
  membershipId: z.uuid(),
  role: AdjustableSalonRoleSchema,
  version: z.number().int().nonnegative(),
});
export type CollaboratorRoleChanged = z.infer<typeof CollaboratorRoleChangedSchema>;

/** UC-011 — POST /api/salon/team/:id/removal : retirer un collaborateur de l'équipe du salon actif. */
export const RemoveCollaboratorSchema = z
  .object({
    version: z.number().int().nonnegative('Indiquez la version consultée.'),
  })
  .strict();
export type RemoveCollaborator = z.infer<typeof RemoveCollaboratorSchema>;

export const CollaboratorRemovedSchema = z.object({
  membershipId: z.uuid(),
  status: z.literal('REVOKED'),
  version: z.number().int().nonnegative(),
});
export type CollaboratorRemoved = z.infer<typeof CollaboratorRemovedSchema>;
