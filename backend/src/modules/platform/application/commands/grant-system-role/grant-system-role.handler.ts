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
import { SystemRoleAuthorityLostError } from '../../../domain/exceptions/system-role-authority-lost.error.js';
import { SelfSystemRoleModificationError } from '../../../domain/exceptions/self-system-role-modification.error.js';
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
import { GrantSystemRole } from './grant-system-role.command.js';
import type { GrantSystemRoleResponse } from './grant-system-role.response.js';

@CommandHandler(GrantSystemRole)
export class GrantSystemRoleHandler implements ICommandHandler<GrantSystemRole> {
  constructor(
    @Inject(PLATFORM_ADMIN_REPOSITORY) private readonly admins: PlatformAdminRepository,
    @Inject(STAFF_ACCOUNT_LOOKUP) private readonly accounts: StaffAccountLookup,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: GrantSystemRole): Promise<GrantSystemRoleResponse> {
    const phone = PhoneNumber.parse(cmd.phone);
    const target = await this.accounts.findByPhone(phone);
    if (!target) throw new StaffAccountNotFoundError();
    if (!target.hasPassword) throw new StaffAccountRequiredError();
    if (target.userId === cmd.actorUserId) throw new SelfSystemRoleModificationError();

    await this.admins.lockSuperAdminChanges();
    const author = await this.admins.loadForUser(cmd.actorUserId);
    if (!author.hasRole(SystemRole.SUPER_ADMIN)) throw new SystemRoleAuthorityLostError();

    const now = this.clock.now();
    const admin = await this.admins.loadForUser(target.userId);
    admin.grantRole({ role: cmd.role, actorUserId: cmd.actorUserId, now });
    await this.admins.save(admin);

    await this.audit.record({
      action: 'SYSTEM_ROLE_GRANTED',
      subjectType: 'user',
      subjectId: target.userId,
      actorUserId: cmd.actorUserId,
      occurredAt: now,
      details: { role: cmd.role },
    });

    return {
      userId: target.userId,
      role: cmd.role,
      grantedAt: now.toISOString(),
    };
  }
}

