import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Inject, Injectable } from '@nestjs/common';
import { ID_GENERATOR, type IdGenerator } from '../../../../../shared/application/ports.js';
import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { SignInAttemptRepository } from '../../../domain/repositories/write/sign-in-attempt.repository.js';
import type { SignInAttempt } from '../../../domain/value-objects/sign-in-attempt.js';
import { SignInAttemptOrmEntity } from '../orm-entities/sign-in-attempt.orm-entity.js';

@Injectable()
export class TypeOrmSignInAttemptRepository implements SignInAttemptRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  private get repo() {
    return this.txHost.tx.getRepository(SignInAttemptOrmEntity);
  }

  /** Verrou consultatif PostgreSQL libéré au commit ou à l'annulation de la transaction en cours. */
  async lockSignInsFor(phone: PhoneNumber): Promise<void> {
    await this.txHost.tx.query(`SELECT pg_advisory_xact_lock(hashtext('sign-in:' || $1))`, [phone.value]);
  }

  async add(attempt: SignInAttempt): Promise<void> {
    await this.repo.insert({
      id: this.ids.next(),
      phone: attempt.phone,
      networkAddress: attempt.networkAddress,
      attemptedAt: attempt.at,
      succeeded: attempt.succeeded,
      fromKnownDevice: attempt.fromKnownDevice,
    });
  }

  async purgeBefore(before: Date): Promise<number> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .where('attempted_at < :before', { before })
      .execute();
    return result.affected ?? 0;
  }
}
