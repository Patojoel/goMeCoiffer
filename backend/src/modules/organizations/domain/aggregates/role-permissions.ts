import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import type { InvitableSalonRole } from '../enums/invitable-salon-role.enum.js';
import { ADJUSTABLE_SALON_ROLES, type AdjustablePermission } from '../enums/permission.enum.js';
import { RolePermissionsAdjusted } from '../events/role-permissions-adjusted.js';
import { OwnerRoleNotAdjustableError } from '../exceptions/owner-role-not-adjustable.error.js';
import { RolePermissionsChangedMeanwhileError } from '../exceptions/role-permissions-changed-meanwhile.error.js';
import { RolePermissionSet } from '../value-objects/role-permission-set.js';

export interface RolePermissionsState {
  salonId: string;
  role: InvitableSalonRole;
  permissions: readonly AdjustablePermission[];
  version: number;
  updatedAt: Date;
  updatedBy: string | null;
}

export class RolePermissions extends AggregateRoot {
  private constructor(private readonly state: RolePermissionsState) {
    super();
  }

  static initializeDefaultForSalon(input: {
    salonId: string;
    role: string;
    now: Date;
  }): RolePermissions {
    const role = ADJUSTABLE_SALON_ROLES.find((allowed) => allowed === input.role);
    if (!role) throw new OwnerRoleNotAdjustableError();
    return new RolePermissions({
      salonId: input.salonId,
      role,
      permissions: RolePermissionSet.defaultFor(role).toArray(),
      version: 0,
      updatedAt: input.now,
      updatedBy: null,
    });
  }

  static restore(state: Readonly<RolePermissionsState>): RolePermissions {
    return new RolePermissions({ ...state, permissions: [...state.permissions] });
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  get salonId(): string {
    return this.state.salonId;
  }

  get role(): InvitableSalonRole {
    return this.state.role;
  }

  get permissions(): readonly AdjustablePermission[] {
    return [...this.state.permissions];
  }

  get version(): number {
    return this.state.version;
  }

  private get currentSet(): RolePermissionSet {
    return RolePermissionSet.create(this.state.permissions);
  }

  adjustPermissions(input: {
    permissions: RolePermissionSet;
    expectedVersion: number;
    resetToDefault?: boolean;
    actorUserId: string;
    now: Date;
  }): {
    changed: boolean;
    added: readonly AdjustablePermission[];
    removed: readonly AdjustablePermission[];
    resetToDefault: boolean;
  } {
    if (input.expectedVersion !== this.state.version) {
      throw new RolePermissionsChangedMeanwhileError();
    }
    const previous = this.currentSet;
    if (input.permissions.equals(previous)) {
      return { changed: false, added: [], removed: [], resetToDefault: false };
    }
    const added = input.permissions.addedSince(previous);
    const removed = input.permissions.removedSince(previous);
    const resetToDefault = Boolean(input.resetToDefault) && input.permissions.matchesDefaultOf(this.state.role);
    this.state.permissions = input.permissions.toArray();
    this.state.updatedAt = input.now;
    this.state.updatedBy = input.actorUserId;
    this.record(
      new RolePermissionsAdjusted(
        this.state.salonId,
        this.state.role,
        added,
        removed,
        resetToDefault,
        input.actorUserId,
        input.now,
      ),
    );
    return { changed: true, added, removed, resetToDefault };
  }

  markPersisted(): void {
    this.state.version = this.state.version === 0 ? 1 : this.state.version + 1;
  }

  snapshot(): Readonly<RolePermissionsState> {
    return { ...this.state, permissions: [...this.state.permissions] };
  }
}
