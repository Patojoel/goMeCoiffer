import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { SqlReader } from '../../application/ports.js';
import type { SqlStatement } from '../../application/sql.js';
import { NotFoundError } from '../../domain/errors.js';

/** Exécute le SQL pur des QueryHandlers hors transaction (lecture de données commitées). */
@Injectable()
export class TypeOrmSqlReader implements SqlReader {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async many<T>(query: SqlStatement): Promise<readonly T[]> {
    return (await this.dataSource.query(query.text, [...query.values])) as T[];
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
