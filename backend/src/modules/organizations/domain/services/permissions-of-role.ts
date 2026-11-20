import {
  ADJUSTABLE_PERMISSIONS,
  ADJUSTABLE_SALON_ROLES,
  PROTECTED_OWNER_RIGHTS,
  SALON_PERMISSIONS,
} from '../enums/permission.enum.js';

const COLLABORATOR_ROLES: ReadonlySet<string> = new Set(ADJUSTABLE_SALON_ROLES);
const ADJUSTABLE_SET: ReadonlySet<string> = new Set(ADJUSTABLE_PERMISSIONS);

export function permissionsOfMember(
  role: string | null,
  ownsOrganization: boolean,
  configuredPermissions?: readonly string[] | null,
): readonly string[] {
  if (role === 'OWNER') {
    return ownsOrganization ? [...SALON_PERMISSIONS, ...PROTECTED_OWNER_RIGHTS] : [...SALON_PERMISSIONS];
  }
  if (role !== null && COLLABORATOR_ROLES.has(role)) {
    return configuredPermissions ? configuredPermissions.filter((p) => ADJUSTABLE_SET.has(p)) : [];
  }
  return [];
}

export const permissionsOfRole = permissionsOfMember;
