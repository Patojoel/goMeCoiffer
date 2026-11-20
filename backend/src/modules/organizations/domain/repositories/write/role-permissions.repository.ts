import type { RolePermissions } from '../../aggregates/role-permissions.js';
import type { InvitableSalonRole } from '../../enums/invitable-salon-role.enum.js';

export const ROLE_PERMISSIONS_REPOSITORY = Symbol('ROLE_PERMISSIONS_REPOSITORY');

export interface RolePermissionsRepository {
  getOfSalon(salonId: string, role: InvitableSalonRole): Promise<RolePermissions>;
  initializeDefaultsIfAbsent(defaults: readonly RolePermissions[]): Promise<void>;
  save(rolePermissions: RolePermissions): Promise<void>;
}

