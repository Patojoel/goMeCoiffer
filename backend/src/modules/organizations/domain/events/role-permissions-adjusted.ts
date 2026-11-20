import type { DomainEvent } from '../../../../shared/domain/domain-event.js';
import type { InvitableSalonRole } from '../enums/invitable-salon-role.enum.js';
import type { AdjustablePermission } from '../enums/permission.enum.js';

export class RolePermissionsAdjusted implements DomainEvent {
  constructor(
    readonly salonId: string,
    readonly role: InvitableSalonRole,
    readonly added: readonly AdjustablePermission[],
    readonly removed: readonly AdjustablePermission[],
    readonly resetToDefault: boolean,
    readonly adjustedByUserId: string,
    readonly occurredAt: Date,
  ) {}
}

