import { CannotManageOwnMembershipError } from '../exceptions/cannot-manage-own-membership.error.js';
import { RoleAboveManagerError } from '../exceptions/role-above-manager.error.js';

export class TeamManagementPolicy {
  assertCanChangeRole(input: {
    actorUserId: string;
    targetUserId: string;
    actorPermissions: readonly string[];
    currentRolePermissions: readonly string[] | null;
    newRolePermissions: readonly string[] | null;
  }): void {
    if (input.actorUserId === input.targetUserId) {
      throw new CannotManageOwnMembershipError();
    }
    this.assertSubsumes(input.actorPermissions, input.currentRolePermissions);
    this.assertSubsumes(input.actorPermissions, input.newRolePermissions);
  }

  assertCanRevoke(input: {
    actorUserId: string;
    targetUserId: string;
    actorPermissions: readonly string[];
    currentRolePermissions: readonly string[] | null;
  }): void {
    if (input.actorUserId === input.targetUserId) {
      throw new CannotManageOwnMembershipError();
    }
    this.assertSubsumes(input.actorPermissions, input.currentRolePermissions);
  }

  private assertSubsumes(
    actorPermissions: readonly string[],
    requiredPermissions: readonly string[] | null,
  ): void {
    if (requiredPermissions === null) throw new RoleAboveManagerError();
    const held = new Set(actorPermissions);
    if (requiredPermissions.some((permission) => !held.has(permission))) {
      throw new RoleAboveManagerError();
    }
  }
}
