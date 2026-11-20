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
import { SystemRole } from '../../../domain/enums/system-role.enum.js';
import { LastSuperAdminError } from '../../../domain/exceptions/last-super-admin.error.js';
import { SystemRoleAuthorityLostError } from '../../../domain/exceptions/system-role-authority-lost.error.js';
import { SelfSystemRoleModificationError } from '../../../domain/exceptions/self-system-role-modification.error.js';
import {
  USER_SESSIONS_REVOKER,
  type UserSessionsRevoker,
} from '../../../domain/ports/user-sessions-revoker.port.js';
import {
  PLATFORM_ADMIN_REPOSITORY,
  type PlatformAdminRepository,
} from '../../../domain/repositories/write/platform-admin.repository.js';
import { RevokeSystemRole } from './revoke-system-role.command.js';
import type { RevokeSystemRoleResponse } from './revoke-system-role.response.js';

@CommandHandler(RevokeSystemRole)
export class RevokeSystemRoleHandler implements ICommandHandler<RevokeSystemRole> {
  private readonly logger = new Logger(RevokeSystemRoleHandler.name);

  constructor(
    @Inject(PLATFORM_ADMIN_REPOSITORY) private readonly admins: PlatformAdminRepository,
    @Inject(USER_SESSIONS_REVOKER) private readonly sessionsRevoker: UserSessionsRevoker,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(REALTIME_PUBLISHER) private readonly realtime: RealtimePublisher,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(cmd: RevokeSystemRole): Promise<RevokeSystemRoleResponse> {
    if (cmd.targetUserId === cmd.actorUserId) throw new SelfSystemRoleModificationError();

    await this.admins.lockSuperAdminChanges();

    const now = this.clock.now();
    const admin = await this.admins.loadForUser(cmd.targetUserId);
    admin.revokeRole({ role: cmd.role, actorUserId: cmd.actorUserId, now });

    if (cmd.role === SystemRole.SUPER_ADMIN) {
      const superAdmins = await this.admins.countSuperAdmins();
      if (superAdmins <= 1) throw new LastSuperAdminError();
    }

    // Après le test du dernier Super Administrateur : deux retraits croisés gardent leur refus 409 historique.
    const author = await this.admins.loadForUser(cmd.actorUserId);
    if (!author.hasRole(SystemRole.SUPER_ADMIN)) throw new SystemRoleAuthorityLostError();

    await this.admins.save(admin);
    await this.sessionsRevoker.revokeAllSessionsOf(cmd.targetUserId);

    await this.audit.record({
      action: 'SYSTEM_ROLE_REVOKED',
      subjectType: 'user',
      subjectId: cmd.targetUserId,
      actorUserId: cmd.actorUserId,
      occurredAt: now,
      details: { role: cmd.role },
    });

    try {
      this.realtime.closeStreamsOfUser(cmd.targetUserId);
    } catch (error) {
      this.logger.error({ err: error }, 'Fermeture des flux temps réel en échec (ignorée)');
    }

    return {
      userId: cmd.targetUserId,
      role: cmd.role,
      revokedAt: now.toISOString(),
    };
  }
}
