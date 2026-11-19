import { Permission, ProtectedOwnerRight } from '../enums/permission.enum.js';

const SALON_PERMISSIONS: readonly string[] = Object.values(Permission);
const PROTECTED_RIGHTS: readonly string[] = Object.values(ProtectedOwnerRight);

/**
 * Le rôle Owner donne tout le catalogue du salon ; les droits protégés (fonds, facturation, salons) exigent en plus
 * d'être le propriétaire réel de l'organisation, pas seulement de porter le rôle. Un rôle sans permissions définies
 * (UC-008) n'a rien.
 */
export function permissionsOfRole(role: string | null, ownsOrganization: boolean): readonly string[] {
  if (role !== 'OWNER') return [];
  return ownsOrganization ? [...SALON_PERMISSIONS, ...PROTECTED_RIGHTS] : SALON_PERMISSIONS;
}
