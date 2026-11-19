import { SalonRole } from './salon-role.enum.js';

/** Les quatre rôles de collaborateur : ni Propriétaire (droits protégés) ni rôle système (D-042). */
export const INVITABLE_SALON_ROLES = [
  SalonRole.SALON_ADMIN,
  SalonRole.HAIRDRESSER,
  SalonRole.FINANCE_MANAGER,
  SalonRole.PRACTITIONER,
] as const;
export type InvitableSalonRole = (typeof INVITABLE_SALON_ROLES)[number];
