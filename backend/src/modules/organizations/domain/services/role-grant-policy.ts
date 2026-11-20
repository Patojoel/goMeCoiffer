import { RoleAboveInviterError } from '../exceptions/role-above-inviter.error.js';

export class RoleGrantPolicy {
  assertCanGrant(
    authorPermissions: readonly string[],
    rolePermissionsInSalon: readonly string[] | null,
  ): void {
    if (rolePermissionsInSalon === null) throw new RoleAboveInviterError();
    const held = new Set(authorPermissions);
    if (rolePermissionsInSalon.some((permission) => !held.has(permission))) {
      throw new RoleAboveInviterError();
    }
  }
}
