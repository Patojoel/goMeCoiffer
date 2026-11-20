import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { READ_DB, type SqlReader } from '../../../../../shared/application/ports.js';
import { sql } from '../../../../../shared/application/sql.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { GetMyClientSession } from './get-my-client-session.query.js';
import type { ClientSessionSummaryReadModel } from './get-my-client-session.read-model.js';

/** Index : clé primaire `users_pkey` sur `users (id)`. Projection minimale : seul `phone` est lu puis masqué (RG-009-10). */
@QueryHandler(GetMyClientSession)
export class GetMyClientSessionHandler implements IQueryHandler<GetMyClientSession> {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  async execute(q: GetMyClientSession): Promise<ClientSessionSummaryReadModel> {
    const row = await this.db.one<{ phone: string }>(sql`
      SELECT u.phone
      FROM users u
      WHERE u.id = ${q.userId}`);
    return {
      kind: q.kind,
      maskedPhone: PhoneNumber.parse(row.phone).masked(),
    };
  }
}
