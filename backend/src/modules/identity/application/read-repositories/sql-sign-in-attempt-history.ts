import { Inject, Injectable } from '@nestjs/common';
import { READ_DB, type SqlReader } from '../../../../shared/application/ports.js';
import { sql } from '../../../../shared/application/sql.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { SignInAttemptHistory } from '../../domain/repositories/read/sign-in-attempt-history.read-repository.js';
import { NETWORK_WINDOW_MS, PHONE_DAILY_WINDOW_MS } from '../../domain/services/sign-in-attempt-policy.js';
import type { SignInAttempt } from '../../domain/value-objects/sign-in-attempt.js';

/**
 * Lue dans la transaction de la connexion, après le verrou par numéro (READ COMMITTED : elle voit les essais que
 * les connexions précédentes ont commités). Index : `sign_in_attempts (phone, attempted_at DESC)` pour le numéro,
 * index partiel `(network_address, attempted_at DESC) WHERE NOT succeeded AND NOT from_known_device` pour l'adresse.
 */
@Injectable()
export class SqlSignInAttemptHistory implements SignInAttemptHistory {
  constructor(@Inject(READ_DB) private readonly db: SqlReader) {}

  recentAttempts(phone: PhoneNumber, networkAddress: string, now: Date): Promise<readonly SignInAttempt[]> {
    const phoneSince = new Date(now.getTime() - PHONE_DAILY_WINDOW_MS);
    const networkSince = new Date(now.getTime() - NETWORK_WINDOW_MS);
    return this.db.many<SignInAttempt>(sql`
      SELECT a.phone, a.network_address AS "networkAddress", a.attempted_at AS "at",
             a.succeeded, a.from_known_device AS "fromKnownDevice"
      FROM sign_in_attempts a
      WHERE (a.phone = ${phone.value} AND a.attempted_at > ${phoneSince})
         OR (a.network_address = ${networkAddress} AND a.attempted_at > ${networkSince}
             AND NOT a.succeeded AND NOT a.from_known_device)`);
  }
}
