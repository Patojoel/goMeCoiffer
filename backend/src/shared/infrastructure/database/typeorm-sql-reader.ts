import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import type { SqlReader } from '../../application/ports.js';
import type { SqlStatement } from '../../application/sql.js';
import { NotFoundError } from '../../domain/errors.js';

/**
 * Exécute le SQL pur des lectures. Dans une commande, la lecture passe par la transaction en cours : elle voit
 * ce que la commande a déjà écrit et n'occupe pas une deuxième connexion du pool. Hors commande (QueryHandler),
 * elle lit les données commitées.
 */
@Injectable()
export class TypeOrmSqlReader implements SqlReader {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async many<T>(query: SqlStatement): Promise<readonly T[]> {
    return (await this.txHost.tx.query(query.text, [...query.values])) as T[];
  }

  async one<T>(query: SqlStatement): Promise<T> {
    const row = await this.maybeOne<T>(query);
    if (row === null) throw new NotFoundError('Ressource introuvable.');
    return row;
  }

  async maybeOne<T>(query: SqlStatement): Promise<T | null> {
    const rows = await this.many<T>(query);
    return rows[0] ?? null;
  }
}
