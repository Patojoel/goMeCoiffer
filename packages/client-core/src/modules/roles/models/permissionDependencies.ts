import { ADJUSTABLE_PERMISSIONS, type AdjustablePermission } from '@gomecoiffer/contracts';

export const REQUIRED_VIEW_BY_ACTION: Readonly<
  Partial<Record<AdjustablePermission, AdjustablePermission>>
> = {
  'bookings:manage': 'bookings:view-all',
  'services:manage': 'services:view',
  'staff:invite': 'staff:view',
  'staff:manage': 'staff:view',
  'finances:record-payment': 'finances:view',
  'finances:export': 'finances:view',
  'salon-settings:edit': 'salon-settings:view',
};

export function applyPermissionToggleWithDependencies(
  current: readonly AdjustablePermission[],
  permission: AdjustablePermission,
  enable: boolean,
): {
  readonly permissions: readonly AdjustablePermission[];
  readonly autoChanged: readonly AdjustablePermission[];
} {
  const next = new Set<AdjustablePermission>(current);
  const autoChanged: AdjustablePermission[] = [];

  if (enable) {
    next.add(permission);
    const requiredView = REQUIRED_VIEW_BY_ACTION[permission];
    if (requiredView && !next.has(requiredView)) {
      next.add(requiredView);
      autoChanged.push(requiredView);
    }
  } else {
    next.delete(permission);
    for (const [action, requiredView] of Object.entries(REQUIRED_VIEW_BY_ACTION) as Array<
      [AdjustablePermission, AdjustablePermission]
    >) {
      if (requiredView === permission && next.has(action)) {
        next.delete(action);
        autoChanged.push(action);
      }
    }
  }

  return {
    permissions: ADJUSTABLE_PERMISSIONS.filter((p) => next.has(p)),
    autoChanged,
  };
}
