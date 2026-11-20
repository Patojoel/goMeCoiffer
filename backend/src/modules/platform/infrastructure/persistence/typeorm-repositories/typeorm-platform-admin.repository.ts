import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { isPgError } from '../../../../../shared/infrastructure/database/pg-error.js';
import { DomainEventDispatcher } from '../../../../../shared/infrastructure/events/domain-event-dispatcher.js';
import { PlatformAdmin } from '../../../domain/aggregates/platform-admin.js';
import { SystemRole } from '../../../domain/enums/system-role.enum.js';
import { SystemRoleAlreadyGrantedError } from '../../../domain/exceptions/system-role-already-granted.error.js';
import { SystemRoleNotAssignedError } from '../../../domain/exceptions/system-role-not-assigned.error.js';
import type { PlatformAdminRepository } from '../../../domain/repositories/write/platform-admin.repository.js';
import { PlatformAdminRoleOrmEntity } from '../orm-entities/platform-admin-role.orm-entity.js';

@Injectable()
export class TypeOrmPlatformAdminRepository implements PlatformAdminRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly events: DomainEventDispatcher,
  ) {}

  private get repo() {
    return this.txHost.tx.getRepository(PlatformAdminRoleOrmEntity);
  }

  async loadForUser(userId: string): Promise<PlatformAdmin> {
    const rows = await this.repo.findBy({ userId });
    return PlatformAdmin.restore({
      userId,
      roles: rows.map((row) => ({
        role: row.role as SystemRole,
        grantedAt: row.grantedAt,
        grantedByUserId: row.grantedByUserId,
      })),
    });
  }

  async lockSuperAdminChanges(): Promise<void> {
    await this.txHost.tx.query(`SELECT pg_advisory_xact_lock(hashtext('platform:super_admin'))`);
  }

  async countSuperAdmins(): Promise<number> {
    const rows = (await this.txHost.tx.query(
      `SELECT COUNT(*)::int AS count FROM platform_admin_roles WHERE role = $1`,
      [SystemRole.SUPER_ADMIN],
    )) as [{ count: number }];
    return rows[0].count;
  }

  async save(admin: PlatformAdmin): Promise<void> {
    const { userId, addedRoles, removedRoles } = admin.snapshot();
    try {
      for (const added of addedRoles) {
        await this.repo.insert({
          userId,
          role: added.role,
          grantedAt: added.grantedAt,
          grantedByUserId: added.grantedByUserId,
        });
      }
      for (const role of removedRoles) {
        const { affected } = await this.repo.delete({ userId, role });
        if (affected === 0) throw new SystemRoleNotAssignedError();
      }
    } catch (error) {
      if (isPgError(error, '23505')) throw new SystemRoleAlreadyGrantedError();
      throw error;
    }
    admin.markPersisted();
    await this.events.dispatch(admin.pullEvents());
  }
}
