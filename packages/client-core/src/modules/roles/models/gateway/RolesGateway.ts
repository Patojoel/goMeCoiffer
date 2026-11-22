import type {
  AdjustRolePermissions,
  AdjustableSalonRole,
  RolePermissionsAdjusted,
  SalonRoles,
} from '@gomecoiffer/contracts';

export interface RolesGateway {
  getRoles(): Promise<SalonRoles>;
  adjustRolePermissions(
    role: AdjustableSalonRole,
    input: AdjustRolePermissions,
  ): Promise<RolePermissionsAdjusted>;
}
