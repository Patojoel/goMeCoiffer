import {
  DEFAULT_ROLE_PERMISSIONS,
  RESERVED_OWNER_RIGHTS,
  SALON_PERMISSIONS,
  type AdjustRolePermissions,
  type AdjustableSalonRole,
  type RolePermissionsAdjusted,
  type SalonRoles,
} from '@gomecoiffer/contracts';
import { HttpError } from '../../../../http/HttpError.js';
import type { RolesGateway } from '../../models/gateway/RolesGateway.js';

export class InMemoryRolesGateway implements RolesGateway {
  public rolesData: SalonRoles;
  public nextError: Error | null = null;

  constructor(initial?: SalonRoles) {
    this.rolesData = initial ?? {
      owner: {
        permissions: [...SALON_PERMISSIONS],
        reservedRights: [...RESERVED_OWNER_RIGHTS],
        members: 1,
      },
      roles: (['SALON_ADMIN', 'HAIRDRESSER', 'FINANCE_MANAGER', 'PRACTITIONER'] as const).map(
        (role) => ({
          role,
          permissions: [...DEFAULT_ROLE_PERMISSIONS[role]],
          defaultPermissions: [...DEFAULT_ROLE_PERMISSIONS[role]],
          isDefault: true,
          members: role === 'HAIRDRESSER' ? 2 : 0,
          version: 1,
        }),
      ),
    };
  }

  private assertHealthy() {
    if (this.nextError) {
      const err = this.nextError;
      this.nextError = null;
      throw err;
    }
  }

  async getRoles(): Promise<SalonRoles> {
    this.assertHealthy();
    return {
      owner: { ...this.rolesData.owner },
      roles: this.rolesData.roles.map((r) => ({ ...r, permissions: [...r.permissions] })),
    };
  }

  async adjustRolePermissions(
    role: AdjustableSalonRole,
    input: AdjustRolePermissions,
  ): Promise<RolePermissionsAdjusted> {
    this.assertHealthy();
    const entry = this.rolesData.roles.find((r) => r.role === role);
    if (!entry) throw new HttpError(404, 'NOT_FOUND', 'Rôle introuvable.');
    if (entry.version !== input.version) {
      throw new HttpError(409, 'ROLE_PERMISSIONS_CHANGED_MEANWHILE', 'Les permissions ont changé.');
    }

    const nextPermissions = input.resetToDefault
      ? [...entry.defaultPermissions]
      : [...input.permissions];
    const nextVersion = entry.version + 1;
    const isDefault =
      nextPermissions.length === entry.defaultPermissions.length &&
      entry.defaultPermissions.every((p) => nextPermissions.includes(p));

    this.rolesData = {
      ...this.rolesData,
      roles: this.rolesData.roles.map((r) =>
        r.role === role
          ? { ...r, permissions: nextPermissions, isDefault, version: nextVersion }
          : r,
      ),
    };
    return { role, permissions: nextPermissions, version: nextVersion };
  }
}
