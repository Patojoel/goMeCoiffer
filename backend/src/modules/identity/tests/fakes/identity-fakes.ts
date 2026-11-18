import type { AuditEntry, AuditTrail } from '../../../../shared/application/ports.js';
import { ConcurrencyConflictError } from '../../../../shared/domain/errors.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { OtpChallenge } from '../../domain/aggregates/otp-challenge.js';
import { User } from '../../domain/aggregates/user.js';
import type { OtpPurpose } from '../../domain/enums/otp-purpose.enum.js';
import { SmsDeliveryFailedError } from '../../domain/exceptions/sms-delivery-failed.error.js';
import type { CommonPasswords } from '../../domain/ports/common-passwords.port.js';
import type { OtpCodeGenerator } from '../../domain/ports/otp-code-generator.port.js';
import type { PasswordHasher } from '../../domain/ports/password-hasher.port.js';
import type { SecretHasher } from '../../domain/ports/secret-hasher.port.js';
import type { SmsSender } from '../../domain/ports/sms-sender.port.js';
import type { OtpSendHistory } from '../../domain/repositories/read/otp-send-history.read-repository.js';
import type { OtpChallengeRepository } from '../../domain/repositories/write/otp-challenge.repository.js';
import type { UserRepository } from '../../domain/repositories/write/user.repository.js';
import type { NewPassword } from '../../domain/value-objects/new-password.js';

/** Empreinte lisible en test ; l'intégration utilise le vrai HMAC. */
export const fakeSecretHasher: SecretHasher = {
  hash: (secret) => `h:${secret}`,
  matches: (candidate, hash) => hash === `h:${candidate}`,
};

export const fakePasswordHasher: PasswordHasher = {
  hash: async (password: NewPassword) => `argon:${password.value}`,
};

/** Reproduit la normalisation de l'adaptateur réel : la base sans chiffres ni symboles finaux est comparée. */
export const commonPasswords: CommonPasswords = {
  includes: (candidate) => {
    const base = candidate.toLowerCase().replace(/[\d\W_]+$/, '');
    return ['motdepasse', 'azerty', 'password', 'coiffeur'].includes(base);
  },
};

export class FixedOtpCodes implements OtpCodeGenerator {
  constructor(private readonly codes: string[]) {}
  next(): string {
    const code = this.codes.shift();
    if (!code) throw new Error('FixedOtpCodes : plus de code prévu par le test');
    return code;
  }
}

export class InMemorySmsSender implements SmsSender {
  readonly sent: { to: string; text: string }[] = [];
  outage = false;

  async send(to: PhoneNumber, text: string): Promise<void> {
    if (this.outage) throw new SmsDeliveryFailedError();
    this.sent.push({ to: to.value, text });
  }

  lastTo(phone: string): string | undefined {
    return this.sent.filter((s) => s.to === phone).at(-1)?.text;
  }
}

/** Comme le repository réel : une ligne par défi, verrou optimiste, un seul défi actif par numéro et motif. */
export class InMemoryOtpChallengeRepository implements OtpChallengeRepository {
  private readonly rows = new Map<string, ReturnType<OtpChallenge['snapshot']>>();

  async findActive(phone: PhoneNumber, purpose: OtpPurpose) {
    const row = [...this.rows.values()].find(
      (r) => r.phone === phone.value && r.purpose === purpose && r.status === 'ACTIVE',
    );
    return row ? OtpChallenge.restore(row) : null;
  }

  /** Les tests unitaires sont séquentiels ; la sérialisation réelle est prouvée en E2E. */
  async lockSendingFor() {}

  async save(challenge: OtpChallenge) {
    const next = challenge.snapshot();
    const current = this.rows.get(next.id);
    if ((current?.version ?? 0) !== next.version) throw new ConcurrencyConflictError('OtpChallenge', next.id);
    this.rows.set(next.id, { ...next, version: next.version + 1 });
  }

  all() {
    return [...this.rows.values()];
  }
}

/** Lit les défis du faux repository d'écriture, comme la requête SQL lit la table `otp_challenges`. */
export class InMemoryOtpSendHistory implements OtpSendHistory {
  constructor(private readonly challenges: InMemoryOtpChallengeRepository) {}

  async recentSends(phone: PhoneNumber, purpose: OtpPurpose, since: Date) {
    return this.challenges
      .all()
      .filter((r) => r.phone === phone.value && r.purpose === purpose && r.sentAt > since)
      .map((r) => ({ sentAt: r.sentAt, failedAttempts: OtpChallenge.restore(r).failedAttempts }));
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, ReturnType<User['snapshot']>>();

  async findByPhone(phone: PhoneNumber) {
    const row = [...this.rows.values()].find((r) => r.phone === phone.value);
    return row ? User.restore(row) : null;
  }

  async save(user: User) {
    const next = user.snapshot();
    const current = this.rows.get(next.id);
    if ((current?.version ?? 0) !== next.version) throw new ConcurrencyConflictError('User', next.id);
    this.rows.set(next.id, { ...next, version: next.version + 1 });
  }

  /** Un compte client léger (UC-009) existant, sans mot de passe. */
  seedLightClient(id: string, phone: PhoneNumber) {
    this.rows.set(
      id,
      User.restore({
        id,
        phone: phone.value,
        name: null,
        email: null,
        passwordHash: null,
        phoneVerifiedAt: new Date('2026-10-01T09:00:00Z'),
        termsAcceptedAt: null,
        createdAt: new Date('2026-10-01T09:00:00Z'),
        version: 1,
      }).snapshot(),
    );
  }

  seedStaff(id: string, phone: PhoneNumber) {
    this.seedLightClient(id, phone);
    const row = this.rows.get(id)!;
    this.rows.set(id, { ...row, name: 'Paul Ebode', passwordHash: 'argon:existing' });
  }

  all() {
    return [...this.rows.values()];
  }
}

export class InMemoryAuditTrail implements AuditTrail {
  readonly entries: AuditEntry[] = [];
  async record(entry: AuditEntry) {
    this.entries.push(entry);
  }
}
