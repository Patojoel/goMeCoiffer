import type { InvitableSalonRole } from '../enums/invitable-salon-role.enum.js';
import {
  ADJUSTABLE_PERMISSIONS,
  ADJUSTABLE_SALON_ROLES,
  type AdjustablePermission,
  Permission,
} from '../enums/permission.enum.js';
import { OwnerRoleNotAdjustableError } from '../exceptions/owner-role-not-adjustable.error.js';
import { PermissionNotAdjustableError } from '../exceptions/permission-not-adjustable.error.js';
import { PermissionRequiresViewError } from '../exceptions/permission-requires-view.error.js';

const ADJUSTABLE_SET: ReadonlySet<string> = new Set(ADJUSTABLE_PERMISSIONS);

const REQUIRED_VIEW_BY_ACTION: Readonly<Partial<Record<AdjustablePermission, AdjustablePermission>>> = {
  [Permission.BOOKINGS_MANAGE]: Permission.BOOKINGS_VIEW_ALL,
  [Permission.SERVICES_MANAGE]: Permission.SERVICES_VIEW,
  [Permission.STAFF_INVITE]: Permission.STAFF_VIEW,
  [Permission.STAFF_MANAGE]: Permission.STAFF_VIEW,
  [Permission.FINANCES_RECORD_PAYMENT]: Permission.FINANCES_VIEW,
  [Permission.FINANCES_EXPORT]: Permission.FINANCES_VIEW,
  [Permission.SALON_SETTINGS_EDIT]: Permission.SALON_SETTINGS_VIEW,
};

const DEFAULT_ROLE_PERMISSIONS: Readonly<
  Record<InvitableSalonRole, readonly AdjustablePermission[]>
> = {
  SALON_ADMIN: [
    Permission.DASHBOARD_VIEW,
    Permission.BOOKINGS_VIEW_OWN,
    Permission.BOOKINGS_VIEW_ALL,
    Permission.BOOKINGS_MANAGE,
    Permission.AVAILABILITY_EDIT_OWN,
    Permission.AVAILABILITY_MANAGE_TEAM,
    Permission.SERVICES_VIEW,
    Permission.SERVICES_MANAGE,
    Permission.STAFF_VIEW,
    Permission.STAFF_INVITE,
    Permission.STAFF_MANAGE,
    Permission.SALON_SETTINGS_VIEW,
  ],
  HAIRDRESSER: [Permission.BOOKINGS_VIEW_OWN, Permission.AVAILABILITY_EDIT_OWN],
  FINANCE_MANAGER: [
    Permission.DASHBOARD_VIEW,
    Permission.BOOKINGS_VIEW_ALL,
    Permission.FINANCES_VIEW,
    Permission.FINANCES_RECORD_PAYMENT,
    Permission.FINANCES_EXPORT,
  ],
  PRACTITIONER: [Permission.BOOKINGS_VIEW_OWN, Permission.AVAILABILITY_EDIT_OWN],
};

export function defaultPermissionsOf(role: InvitableSalonRole): readonly AdjustablePermission[] {
  if (!ADJUSTABLE_SALON_ROLES.includes(role)) throw new OwnerRoleNotAdjustableError();
  return [...DEFAULT_ROLE_PERMISSIONS[role]];
}

export class RolePermissionSet {
  private constructor(private readonly items: readonly AdjustablePermission[]) {}

  static create(codes: readonly string[]): RolePermissionSet {
    const selected = new Set<string>();
    for (const code of codes) {
      if (!ADJUSTABLE_SET.has(code) || selected.has(code)) {
        throw new PermissionNotAdjustableError(code);
      }
      selected.add(code);
    }
    for (const code of codes) {
      const requiredView = REQUIRED_VIEW_BY_ACTION[code as AdjustablePermission];
      if (requiredView && !selected.has(requiredView)) {
        throw new PermissionRequiresViewError(code, requiredView);
      }
    }
    return new RolePermissionSet(ADJUSTABLE_PERMISSIONS.filter((p) => selected.has(p)));
  }

  static defaultFor(role: InvitableSalonRole): RolePermissionSet {
    return new RolePermissionSet(defaultPermissionsOf(role));
  }

  equals(other: RolePermissionSet): boolean {
    return this.items.length === other.items.length && this.items.every((p, i) => p === other.items[i]);
  }

  addedSince(previous: RolePermissionSet): readonly AdjustablePermission[] {
    const before = new Set(previous.items);
    return this.items.filter((p) => !before.has(p));
  }

  removedSince(previous: RolePermissionSet): readonly AdjustablePermission[] {
    const now = new Set(this.items);
    return previous.items.filter((p) => !now.has(p));
  }

  matchesDefaultOf(role: InvitableSalonRole): boolean {
    return this.equals(RolePermissionSet.defaultFor(role));
  }

  toArray(): readonly AdjustablePermission[] {
    return [...this.items];
  }
}
