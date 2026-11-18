import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { ConcurrencyConflictError, ConflictError } from '../../../../shared/domain/errors.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { isPgError } from '../../../../shared/infrastructure/database/pg-error.js';
import type { UserRepository } from '../../domain/ports.js';
import { User } from '../../domain/user.js';
import { UserOrmEntity } from './user.orm-entity.js';

@Injectable()
export class TypeOrmUserRepository implements UserRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  private get repo() {
    return this.txHost.tx.getRepository(UserOrmEntity);
  }

  async findByPhone(phone: PhoneNumber): Promise<User | null> {
    const row = await this.repo.findOneBy({ phone: phone.value });
    if (!row) return null;
    const { updatedAt: _updatedAt, ...state } = row;
    return User.restore(state);
  }

  async save(user: User): Promise<void> {
    const { version, ...row } = user.snapshot();
    try {
      if (version === 0) {
        await this.repo.insert({ ...row, version: 1 });
        return;
      }
      const { affected } = await this.repo
        .createQueryBuilder()
        .update()
        .set({ ...row, version: () => 'version + 1', updatedAt: () => 'now()' })
        .where('id = :id AND version = :version', { id: row.id, version })
        .execute();
      if (affected === 0) throw new ConcurrencyConflictError('User', row.id);
    } catch (error) {
      if (isPgError(error, '23505')) throw new ConflictError('Ce numéro de téléphone a déjà un compte.');
      throw error;
    }
  }
}
