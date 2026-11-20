import { KnownDevice } from '../../domain/aggregates/known-device.js';
import type { DeviceTokenGenerator } from '../../domain/ports/device-token-generator.port.js';
import type { PasswordVerifier } from '../../domain/ports/password-verifier.port.js';
import type { SignInAttemptHistory } from '../../domain/repositories/read/sign-in-attempt-history.read-repository.js';
import type { KnownDeviceRepository } from '../../domain/repositories/write/known-device.repository.js';
import type { SignInAttemptRepository } from '../../domain/repositories/write/sign-in-attempt.repository.js';
import { NETWORK_WINDOW_MS, PHONE_DAILY_WINDOW_MS } from '../../domain/services/sign-in-attempt-policy.js';
import type { SignInAttempt } from '../../domain/value-objects/sign-in-attempt.js';
import type { AfterCommit } from '../../../../shared/application/after-commit.js';
import type { AuditEntry, AuditTrail } from '../../../../shared/application/ports.js';
import { ConcurrencyConflictError } from '../../../../shared/domain/errors.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { OtpChallenge } from '../../domain/aggregates/otp-challenge.js';
import { PhoneProof } from '../../domain/aggregates/phone-proof.js';
import { User } from '../../domain/aggregates/user.js';
import type { OtpPurpose } from '../../domain/enums/otp-purpose.enum.js';
import { SmsDeliveryFailedError } from '../../domain/exceptions/sms-delivery-failed.error.js';
import type { CommonPasswords } from '../../domain/ports/common-passwords.port.js';
import type { OtpCodeGenerator } from '../../domain/ports/otp-code-generator.port.js';
import type { PasswordHasher } from '../../domain/ports/password-hasher.port.js';
import type { SecretHasher } from '../../domain/ports/secret-hasher.port.js';
import type { SmsSender } from '../../domain/ports/sms-sender.port.js';
import type { UserSessions } from '../../domain/ports/user-sessions.port.js';
import type { PendingInvitationsOfPhone } from '../../domain/repositories/read/pending-invitations-of-phone.read-repository.js';
import type { PhoneProofRepository } from '../../domain/repositories/write/phone-proof.repository.js';
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
  /** Erreur quelconque du futur adaptateur (son message peut citer le numéro et le texte). */
  failure: Error | null = null;

  async send(to: PhoneNumber, text: string): Promise<void> {
    if (this.failure) throw this.failure;
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
        credentialsVersion: 1,
        version: 1,
      }).snapshot(),
    );
  }

  seedStaff(id: string, phone: PhoneNumber, passwordHash = 'argon:existing') {
    this.seedLightClient(id, phone);
    const row = this.rows.get(id)!;
    this.rows.set(id, { ...row, name: 'Paul Ebode', passwordHash });
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

/** Compte les vérifications : l'appel à l'empreinte factice (`hash = null`) coûte autant qu'une vraie vérification. */
export class FakePasswordVerifier implements PasswordVerifier {
  verifications = 0;

  async verify(password: string, hash: string | null) {
    this.verifications += 1;
    return hash !== null && [`argon:${password}`, `argon-old:${password}`].includes(hash);
  }

  /** Les empreintes « argon-old: » simulent des réglages dépassés. */
  needsRehash(hash: string) {
    return hash.startsWith('argon-old:');
  }

  async rehash(password: string) {
    return `argon:${password}`;
  }
}

export class FixedDeviceTokens implements DeviceTokenGenerator {
  constructor(private readonly tokens: string[]) {}
  next(): string {
    const token = this.tokens.shift();
    if (!token) throw new Error('FixedDeviceTokens : plus de jeton prévu par le test');
    return token;
  }
}

/** Comme le repository réel : un essai par ligne, jamais modifié. */
export class InMemorySignInAttemptRepository implements SignInAttemptRepository {
  private rows: SignInAttempt[] = [];

  async lockSignInsFor() {}

  async add(attempt: SignInAttempt) {
    this.rows.push(attempt);
  }

  async purgeBefore(before: Date) {
    const kept = this.rows.filter((r) => r.at >= before);
    const purged = this.rows.length - kept.length;
    this.rows = kept;
    return purged;
  }

  all() {
    return [...this.rows];
  }
}

/** Même filtre que la requête SQL : essais du numéro sur 24 h, échecs de l'adresse sur 1 h (appareils non reconnus). */
export class InMemorySignInAttemptHistory implements SignInAttemptHistory {
  constructor(private readonly attempts: InMemorySignInAttemptRepository) {}

  async recentAttempts(phone: PhoneNumber, networkAddress: string, now: Date) {
    const age = (a: SignInAttempt) => now.getTime() - a.at.getTime();
    return this.attempts
      .all()
      .filter(
        (a) =>
          (a.phone === phone.value && age(a) < PHONE_DAILY_WINDOW_MS) ||
          (a.networkAddress === networkAddress &&
            age(a) < NETWORK_WINDOW_MS &&
            !a.succeeded &&
            !a.fromKnownDevice),
      );
  }
}

/** Un appareil par couple (empreinte du jeton, compte), comme la contrainte d'unicité de la base. */
export class InMemoryKnownDeviceRepository implements KnownDeviceRepository {
  private readonly rows = new Map<string, ReturnType<KnownDevice['snapshot']>>();

  lookups = 0;

  async findOf(tokenHashes: readonly string[], userId: string) {
    this.lookups += 1;
    const row = [...this.rows.values()].find((r) => tokenHashes.includes(r.tokenHash) && r.userId === userId);
    return row ? KnownDevice.restore(row) : null;
  }

  async findNotRevokedOf(userId: string) {
    return [...this.rows.values()]
      .filter((r) => r.userId === userId && r.revokedAt === null)
      .map((r) => KnownDevice.restore(r));
  }

  async save(device: KnownDevice) {
    const next = device.snapshot();
    const current = this.rows.get(next.id);
    if ((current?.version ?? 0) !== next.version) throw new ConcurrencyConflictError('KnownDevice', next.id);
    this.rows.set(next.id, { ...next, version: next.version + 1 });
  }

  all() {
    return [...this.rows.values()];
  }
}

/** Sessions ouvertes par utilisateur ; `closeAllOf` ne touche que celles du compte demandé. */
export class InMemoryUserSessions implements UserSessions {
  private readonly open = new Map<string, number>();

  opened(userId: string, count: number) {
    this.open.set(userId, (this.open.get(userId) ?? 0) + count);
  }

  openCountOf(userId: string) {
    return this.open.get(userId) ?? 0;
  }

  async closeAllOf(userId: string) {
    const closed = this.openCountOf(userId);
    this.open.delete(userId);
    return closed;
  }
}

/** Enregistre les flux temps réel fermés (le vrai adaptateur les ferme après le commit). */
export class InMemoryRealtime {
  readonly closedUsers: string[] = [];
  readonly closedSessions: string[] = [];
  closeStreamsOfSession(sessionId: string) {
    this.closedSessions.push(sessionId);
  }
  publishToUser() {}
  publishToSalon() {}
  closeStreamsOfUser(userId: string) {
    this.closedUsers.push(userId);
  }
}

/** Le « commit » est déclenché par le test : `commit()` exécute les actions enregistrées, comme le bus après le commit. */
export class FakeAfterCommit {
  private readonly pending: Array<() => unknown> = [];

  register(callback: () => unknown) {
    this.pending.push(callback);
  }

  registerDetached(callback: () => unknown) {
    this.pending.push(callback);
  }

  async commit() {
    const callbacks = this.pending.splice(0);
    await Promise.all(callbacks.map((callback) => callback()));
  }

  asAfterCommit() {
    return this as unknown as AfterCommit;
  }
}

export class InMemoryPhoneProofRepository implements PhoneProofRepository {
  private readonly rows = new Map<string, ReturnType<PhoneProof['snapshot']>>();

  async add(proof: PhoneProof) {
    const row = proof.snapshot();
    if ([...this.rows.values()].some((r) => r.tokenHash === row.tokenHash)) throw new Error('token_hash déjà pris');
    this.rows.set(row.id, row);
  }

  async findByTokenHash(tokenHash: string) {
    const row = [...this.rows.values()].find((r) => r.tokenHash === tokenHash);
    return row ? PhoneProof.restore(row) : null;
  }

  async deleteByTokenHash(tokenHash: string) {
    for (const row of this.rows.values()) if (row.tokenHash === tokenHash) this.rows.delete(row.id);
  }

  async deleteOfPhone(phone: PhoneNumber) {
    for (const row of this.rows.values()) if (row.phone === phone.value) this.rows.delete(row.id);
  }

  async purgeExpiredAt(now: Date) {
    const expired = [...this.rows.values()].filter((r) => r.expiresAt <= now);
    for (const row of expired) this.rows.delete(row.id);
    return expired.length;
  }

  all() {
    return [...this.rows.values()];
  }
}

/** Numéros qui ont une invitation en attente, déclarés par le test. */
export class InMemoryPendingInvitations implements PendingInvitationsOfPhone {
  private readonly phones = new Set<string>();

  withPendingInvitation(phone: PhoneNumber): this {
    this.phones.add(phone.value);
    return this;
  }

  async existsFor(phone: PhoneNumber) {
    return this.phones.has(phone.value);
  }
}
