import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { PhoneProof } from '../../../domain/aggregates/phone-proof.js';
import type { PhoneProofRepository } from '../../../domain/repositories/write/phone-proof.repository.js';
import { PhoneProofOrmEntity } from '../orm-entities/phone-proof.orm-entity.js';

@Injectable()
export class TypeOrmPhoneProofRepository implements PhoneProofRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  private get repo() {
    return this.txHost.tx.getRepository(PhoneProofOrmEntity);
  }

  async add(proof: PhoneProof): Promise<void> {
    await this.repo.insert(proof.snapshot());
  }

  async findByTokenHash(tokenHash: string): Promise<PhoneProof | null> {
    const row = await this.repo.findOneBy({ tokenHash });
    return row ? PhoneProof.restore(row) : null;
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.repo.delete({ tokenHash });
  }

  async deleteOfPhone(phone: PhoneNumber): Promise<void> {
    await this.repo.delete({ phone: phone.value });
  }

  async purgeExpiredAt(now: Date): Promise<number> {
    const { affected } = await this.repo
      .createQueryBuilder()
      .delete()
      .where('expires_at <= :now', { now })
      .execute();
    return affected ?? 0;
  }
}
