import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  AUDIT_TRAIL,
  type AuditTrail,
  CLOCK,
  type Clock,
} from '../../../../../shared/application/ports.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { SystemRole } from '../../../domain/enums/system-role.enum.js';
import { SuperAdminAlreadyExistsError } from '../../../domain/exceptions/super-admin-already-exists.error.js';
import { StaffAccountNotFoundError } from '../../../domain/exceptions/staff-account-not-found.error.js';
import { StaffAccountRequiredError } from '../../../domain/exceptions/staff-account-required.error.js';
import {
  STAFF_ACCOUNT_LOOKUP,
  type StaffAccountLookup,
} from '../../../domain/ports/staff-account-lookup.port.js';
import {
  PLATFORM_ADMIN_REPOSITORY,
  type PlatformAdminRepository,
} from '../../../domain/repositories/write/platform-admin.repository.js';
import { BootstrapSuperAdmin } from './bootstrap-super-admin.command.js';
import type { BootstrapSuperAdminResponse } from './bootstrap-super-admin.response.js';

/** Commande d'exploitation hors HTTP : nomme le premier Super Administrateur de façon idempotente (RG-012-07). */
@CommandHandler(BootstrapSuperAdmin)
export class BootstrapSuperAdminHandler implements ICommandHandler<BootstrapSuperAdmin> {
  constructor(
    @Inject(PLATFORM_ADMIN_REPOSITORY) private readonly admins: PlatformAdminRepository,
    @Inject(STAFF_ACCOUNT_LOOKUP) private readonly accounts: StaffAccountLookup,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: BootstrapSuperAdmin): Promise<BootstrapSuperAdminResponse> {
    const phone = PhoneNumber.parse(cmd.phone);
    const target = await this.accounts.findByPhone(phone);
    if (!target) throw new StaffAccountNotFoundError();
    if (!target.hasPassword) throw new StaffAccountRequiredError();

    const admin = await this.admins.loadForUser(target.userId);
    const existing = admin.roles.find((entry) => entry.role === SystemRole.SUPER_ADMIN);
    if (existing) {
      return {
        userId: target.userId,
        role: SystemRole.SUPER_ADMIN,
        alreadyAssigned: true,
        existingSuperAdmins: await this.admins.countSuperAdmins(),
        grantedAt: existing.grantedAt.toISOString(),
      };
    }

    const existingSuperAdmins = await this.admins.countSuperAdmins();
    if (existingSuperAdmins > 0 && !cmd.recovery) throw new SuperAdminAlreadyExistsError();

    const now = this.clock.now();
    admin.grantRole({ role: SystemRole.SUPER_ADMIN, actorUserId: null, now });
    await this.admins.save(admin);

    await this.audit.record({
      action: 'SYSTEM_ROLE_GRANTED',
      subjectType: 'user',
      subjectId: target.userId,
      actorUserId: null,
      occurredAt: now,
      details: {
        role: SystemRole.SUPER_ADMIN,
        source: 'SYSTEM_CLI',
        existingSuperAdmins,
        systemUser: cmd.systemUser,
        recovery: cmd.recovery,
      },
    });

    return {
      userId: target.userId,
      role: SystemRole.SUPER_ADMIN,
      alreadyAssigned: false,
      existingSuperAdmins,
      grantedAt: now.toISOString(),
    };
  }
}

