import type { InvitableSalonRole } from '../../enums/invitable-salon-role.enum.js';

export const SALON_ROLE_PERMISSIONS = Symbol('SALON_ROLE_PERMISSIONS');

export interface SalonRolePermissions {
  permissionsOfRoleInSalon(salonId: string, role: InvitableSalonRole): Promise<readonly string[] | null>;
}

