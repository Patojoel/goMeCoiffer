import type { AuditEntry, AuditTrail } from '../../../../shared/application/ports.js';
import { ConcurrencyConflictError } from '../../../../shared/domain/errors.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { CommonPasswords, NewPassword } from '../../domain/new-password.js';
import { OtpChallenge, type OtpPurpose } from '../../domain/otp-challenge.js';
import {
  type OtpChallengeRepository,
  type OtpCodeGenerator,
  type PasswordHasher,
  type SecretHasher,
  SmsDeliveryFailedError,
  type SmsSender,
  type UserRepository,
} from '../../domain/ports.js';
import { User } from '../../domain/user.js';

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

  async recentSends(phone: PhoneNumber, purpose: OtpPurpose, since: Date) {
    return [...this.rows.values()]
      .filter((r) => r.phone === phone.value && r.purpose === purpose && r.sentAt > since)
      .map((r) => ({ sentAt: r.sentAt, failedAttempts: OtpChallenge.restore(r).failedAttempts }));
  }

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
