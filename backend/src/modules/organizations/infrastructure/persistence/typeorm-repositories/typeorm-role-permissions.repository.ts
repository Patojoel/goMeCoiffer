import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../../../shared/domain/errors.js';
import { DomainEventDispatcher } from '../../../../../shared/infrastructure/events/domain-event-dispatcher.js';
import { RolePermissions } from '../../../domain/aggregates/role-permissions.js';
import type { InvitableSalonRole } from '../../../domain/enums/invitable-salon-role.enum.js';
import type { AdjustablePermission } from '../../../domain/enums/permission.enum.js';
import { RolePermissionsChangedMeanwhileError } from '../../../domain/exceptions/role-permissions-changed-meanwhile.error.js';
import type { RolePermissionsRepository } from '../../../domain/repositories/write/role-permissions.repository.js';
import { RolePermissionsOrmEntity } from '../orm-entities/role-permissions.orm-entity.js';

const toDomain = (row: RolePermissionsOrmEntity): RolePermissions =>
  RolePermissions.restore({
    salonId: row.salonId,
    role: row.role as InvitableSalonRole,
    permissions: row.permissions as AdjustablePermission[],
    version: row.version,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
  });

@Injectable()
export class TypeOrmRolePermissionsRepository implements RolePermissionsRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly events: DomainEventDispatcher,
  ) {}

  private get repo() {
    return this.txHost.tx.getRepository(RolePermissionsOrmEntity);
  }

  async getOfSalon(salonId: string, role: InvitableSalonRole): Promise<RolePermissions> {
    const row = await this.repo.findOneBy({ salonId, role });
    if (!row) throw new NotFoundError('Réglage de permissions introuvable.');
    return toDomain(row);
  }

  async initializeDefaultsIfAbsent(defaults: readonly RolePermissions[]): Promise<void> {
    if (defaults.length === 0) return;
    const rows = defaults.map((setting) => {
      const { version: _version, permissions, ...rest } = setting.snapshot();
      return { ...rest, permissions: [...permissions], version: 1 };
    });
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(RolePermissionsOrmEntity)
      .values(rows)
      .orIgnore()
      .execute();
    for (const setting of defaults) {
      await this.events.dispatch(setting.pullEvents());
    }
  }

  async save(rolePermissions: RolePermissions): Promise<void> {
    const { salonId, role, permissions, updatedAt, updatedBy, version } = rolePermissions.snapshot();
    if (rolePermissions.isNew) {
      await this.repo.insert({
        salonId,
        role,
        permissions: [...permissions],
        version: 1,
        updatedAt,
        updatedBy,
      });
    } else {
      const { affected } = await this.repo
        .createQueryBuilder()
        .update()
        .set({
          permissions: [...permissions],
          updatedAt,
          updatedBy,
          version: () => 'version + 1',
        })
        .where('salon_id = :salonId AND role = :role AND version = :version', {
          salonId,
          role,
          version,
        })
        .execute();
      if (affected === 0) throw new RolePermissionsChangedMeanwhileError();
    }
    rolePermissions.markPersisted();
    await this.events.dispatch(rolePermissions.pullEvents());
  }
}

