import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { ConcurrencyConflictError, ConflictError } from '../../../../../shared/domain/errors.js';
import { isPgError } from '../../../../../shared/infrastructure/database/pg-error.js';
import { KnownDevice } from '../../../domain/aggregates/known-device.js';
import type { KnownDeviceRepository } from '../../../domain/repositories/write/known-device.repository.js';
import { KnownDeviceOrmEntity } from '../orm-entities/known-device.orm-entity.js';

@Injectable()
export class TypeOrmKnownDeviceRepository implements KnownDeviceRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  private get repo() {
    return this.txHost.tx.getRepository(KnownDeviceOrmEntity);
  }

  async findOf(tokenHashes: readonly string[], userId: string): Promise<KnownDevice | null> {
    const row = await this.repo.findOne({
      where: { tokenHash: In([...tokenHashes]), userId },
      order: { lastUsedAt: 'DESC' },
    });
    return row ? KnownDevice.restore(row) : null;
  }

  async findNotRevokedOf(userId: string): Promise<KnownDevice[]> {
    const rows = await this.repo.findBy({ userId, revokedAt: IsNull() });
    return rows.map((row) => KnownDevice.restore(row));
  }

  async save(device: KnownDevice): Promise<void> {
    const { version, ...row } = device.snapshot();
    try {
      if (version === 0) {
        await this.repo.insert({ ...row, version: 1 });
        return;
      }
      const { affected } = await this.repo
        .createQueryBuilder()
        .update()
        .set({ ...row, version: () => 'version + 1' })
        .where('id = :id AND version = :version', { id: row.id, version })
        .execute();
      if (affected === 0) throw new ConcurrencyConflictError('KnownDevice', row.id);
    } catch (error) {
      // Index unique (jeton, compte) : deux connexions simultanées depuis le même navigateur.
      if (isPgError(error, '23505')) throw new ConflictError('Connexion simultanée : réessayez.');
      throw error;
    }
  }
}
