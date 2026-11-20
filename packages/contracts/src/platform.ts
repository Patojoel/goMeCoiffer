import { z } from 'zod';

/** Les trois rôles système GoMeCoiffer (PRD §4, D-058). Jamais mélangés aux rôles salon. */
export const SYSTEM_ROLES = ['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN'] as const;
export const SystemRoleSchema = z.enum(SYSTEM_ROLES, {
  error: 'Choisissez un rôle système valide.',
});
export type SystemRole = z.infer<typeof SystemRoleSchema>;

/** UC-012 — POST /api/admin/platform-roles : attribuer un rôle système à un compte du personnel existant. */
export const GrantSystemRoleSchema = z
  .object({
    phone: z.string().trim().min(8, 'Saisissez un numéro camerounais valide.').max(25),
    role: SystemRoleSchema,
  })
  .strict();
export type GrantSystemRole = z.infer<typeof GrantSystemRoleSchema>;

/** Réponse 201 de POST /api/admin/platform-roles. */
export const SystemRoleGrantedSchema = z.object({
  userId: z.uuid(),
  role: SystemRoleSchema,
  grantedAt: z.iso.datetime(),
});
export type SystemRoleGranted = z.infer<typeof SystemRoleGrantedSchema>;

/** Réponse 200 de DELETE /api/admin/platform-roles/:userId/:role. */
export const SystemRoleRevokedSchema = z.object({
  userId: z.uuid(),
  role: SystemRoleSchema,
  revokedAt: z.iso.datetime(),
});
export type SystemRoleRevoked = z.infer<typeof SystemRoleRevokedSchema>;

/** UC-012 — GET /api/admin/platform-roles : liste des administrateurs GoMeCoiffer avec numéro masqué (D-058). */
export const PlatformAdminRoleEntrySchema = z.object({
  role: SystemRoleSchema,
  grantedAt: z.iso.datetime(),
});

export const PlatformAdminSummarySchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  maskedPhone: z.string(),
  roles: z.array(PlatformAdminRoleEntrySchema),
});
export type PlatformAdminSummary = z.infer<typeof PlatformAdminSummarySchema>;

export const PlatformAdminsSchema = z.object({
  superAdminCount: z.number().int().nonnegative(),
  admins: z.array(PlatformAdminSummarySchema),
});
export type PlatformAdmins = z.infer<typeof PlatformAdminsSchema>;

