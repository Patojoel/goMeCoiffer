import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  AUDIT_TRAIL,
  type AuditTrail,
  CLOCK,
  type Clock,
  REALTIME_PUBLISHER,
  type RealtimePublisher,
} from '../../../../../shared/application/ports.js';
import {
  ROLE_PERMISSIONS_REPOSITORY,
  type RolePermissionsRepository,
} from '../../../domain/repositories/write/role-permissions.repository.js';
import { RolePermissionSet } from '../../../domain/value-objects/role-permission-set.js';
import { AdjustRolePermissions } from './adjust-role-permissions.command.js';
import type { AdjustRolePermissionsResponse } from './adjust-role-permissions.response.js';

@CommandHandler(AdjustRolePermissions)
export class AdjustRolePermissionsHandler implements ICommandHandler<AdjustRolePermissions> {
  private readonly logger = new Logger(AdjustRolePermissionsHandler.name);

  constructor(
    @Inject(ROLE_PERMISSIONS_REPOSITORY)
    private readonly rolePermissions: RolePermissionsRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: AdjustRolePermissions): Promise<AdjustRolePermissionsResponse> {
    const now = this.clock.now();
    const permissions = RolePermissionSet.create(cmd.permissions);
    const setting = await this.rolePermissions.getOfSalon(cmd.salonId, cmd.role);
    const { changed, added, removed, resetToDefault } = setting.adjustPermissions({
      permissions,
      expectedVersion: cmd.expectedVersion,
      resetToDefault: cmd.resetToDefault,
      actorUserId: cmd.actorUserId,
      now,
    });

    if (changed) {
      await this.rolePermissions.save(setting);
      await this.audit.record({
        action: 'ROLE_PERMISSIONS_ADJUSTED',
        subjectType: 'salon_role_permissions',
        subjectId: cmd.salonId,
        actorUserId: cmd.actorUserId,
        salonId: cmd.salonId,
        occurredAt: now,
        details: {
          role: cmd.role,
          added: added.join(','),
          removed: removed.join(','),
          resetToDefault,
        },
      });
      try {
        this.realtime.publishToSalon(cmd.salonId, {
          type: 'salon.role_permissions_changed',
          payload: { role: cmd.role },
        });
      } catch (error) {
        const type = error instanceof Error ? error.name : typeof error;
        this.logger.warn(`Signal de permissions non publié (${type})`);
      }
    }

    return {
      role: cmd.role,
      permissions: [...setting.permissions],
      version: setting.version,
    };
  }
}
