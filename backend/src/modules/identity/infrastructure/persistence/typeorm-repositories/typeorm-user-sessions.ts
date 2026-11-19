import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import type { UserSessions } from '../../../domain/ports/user-sessions.port.js';

/** Table `sessions` du store de sessions (connect-pg-simple) ; index d'expression `sessions ((sess->>'userId'))`. */
@Injectable()
export class TypeOrmUserSessions implements UserSessions {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async closeAllOf(userId: string): Promise<number> {
    // Le pilote pg renvoie `[lignes, nombre]` pour un DELETE passé à `query`.
    const result = (await this.txHost.tx.query(`DELETE FROM sessions WHERE sess->>'userId' = $1`, [userId])) as [
      unknown,
      number,
    ];
    return result[1];
  }
}
