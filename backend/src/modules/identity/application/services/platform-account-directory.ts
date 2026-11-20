import { Inject, Injectable } from '@nestjs/common';
import { READ_DB, type SqlReader } from '../../../../shared/application/ports.js';
import { sql } from '../../../../shared/application/sql.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { StaffAccountLookup, StaffAccountMatch } from '../../../platform/domain/ports/staff-account-lookup.port.js';
import type { UserSessionsRevoker } from '../../../platform/domain/ports/user-sessions-revoker.port.js';
import { USER_SESSIONS, type UserSessions } from '../../domain/ports/user-sessions.port.js';
import { USER_REPOSITORY, type UserRepository } from '../../domain/repositories/write/user.repository.js';

/**
 * Pont entre `platform` et `identity` (sans import d'infrastructure inter-modules) :
 * recherche d'un compte par téléphone normalisé et révocation immédiate des sessions d'un utilisateur
 * dans la transaction en cours (RG-012-04, RG-012-08, D-031).
 */
@Injectable()
export class PlatformAccountDirectory implements StaffAccountLookup, UserSessionsRevoker {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(USER_SESSIONS) private readonly sessions: UserSessions,
    @Inject(READ_DB) private readonly db: SqlReader,
  ) {}

  async findByPhone(phone: PhoneNumber): Promise<StaffAccountMatch | null> {
    const user = await this.users.findByPhone(phone);
    if (!user) return null;
    return {
      userId: user.id,
      hasPassword: user.isStaffAccount,
    };
  }

  async revokeAllSessionsOf(userId: string): Promise<void> {
    await this.db.maybeOne<{ id: string }>(sql`
      UPDATE users
      SET credentials_version = credentials_version + 1,
          version = version + 1,
          updated_at = now()
      WHERE id = ${userId}
      RETURNING id
    `);
    await this.sessions.closeAllOf(userId);
  }
}

