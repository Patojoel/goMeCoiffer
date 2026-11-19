import { Inject, Injectable } from '@nestjs/common';
import { READ_DB, type SqlReader } from '../../../../shared/application/ports.js';
import { sql } from '../../../../shared/application/sql.js';
import type { OwnerCandidates } from '../../domain/repositories/read/owner-candidates.read-repository.js';
import type { OwnerCandidate } from '../../domain/value-objects/owner-candidate.js';

/** Index : clé primaire `users (id)`, unicité `organizations (owner_user_id)`. */
@Injectable()
export class SqlOwnerCandidates implements OwnerCandidates {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  of(userId: string): Promise<OwnerCandidate> {
    return this.db.one<OwnerCandidate>(sql`
      SELECT u.id AS "userId",
             u.password_hash IS NOT NULL AS "hasPassword",
             EXISTS (SELECT 1 FROM organizations o WHERE o.owner_user_id = u.id) AS "ownsOrganization"
      FROM users u
      WHERE u.id = ${userId}`);
  }
}
