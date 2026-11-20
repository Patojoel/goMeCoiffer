import { randomUUID } from 'node:crypto';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AUDIT_TRAIL,
  type AuditEntry,
  type AuditTrail,
  CLOCK,
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../shared/application/ports.js';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { TypeOrmAuditTrail } from '../../../../shared/infrastructure/audit/typeorm-audit-trail.js';
import { FixedClock } from '../../../../test-support/fakes.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { ConfirmSignUp } from '../../application/commands/confirm-sign-up/confirm-sign-up.command.js';
import { ResetPassword } from '../../application/commands/reset-password/reset-password.command.js';
import { SignIn } from '../../application/commands/sign-in/sign-in.command.js';
import { VerifyClientCode } from '../../application/commands/verify-client-code/verify-client-code.command.js';
import { InviteeAccountProvider } from '../../application/services/invitee-account-provider.js';
import { ProvenPhone } from '../../application/services/proven-phone.js';
import { OtpChallenge } from '../../domain/aggregates/otp-challenge.js';
import { PhoneProof } from '../../domain/aggregates/phone-proof.js';
import { User } from '../../domain/aggregates/user.js';
import { OtpPurpose } from '../../domain/enums/otp-purpose.enum.js';
import { SECRET_HASHER, type SecretHasher } from '../../domain/ports/secret-hasher.port.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../domain/repositories/write/otp-challenge.repository.js';
import { USER_REPOSITORY, type UserRepository } from '../../domain/repositories/write/user.repository.js';
import { Argon2PasswordVerifier } from '../../infrastructure/crypto/secrets.js';

const NOW = new Date('2026-11-20T09:00:00Z');
const OLD_PROOF = new Date('2026-04-10T14:00:00Z');
const RECENT_PROOF = new Date('2026-11-02T09:00:00Z');

class FailingAuditTrail implements AuditTrail {
  failOnAction: string | null = null;
  delegate: AuditTrail | null = null;

  async record(entry: AuditEntry): Promise<void> {
    if (this.failOnAction === entry.action) {
      throw new Error('Panne forcée pendant la vérification client');
    }
    return this.delegate!.record(entry);
  }
}

describe('Verifying client access and phone holder dates in PostgreSQL', () => {
  let t: TestApp;
  let db: DataSource;
  let bus: TransactionalCommandBus;
  let users: UserRepository;
  let challenges: OtpChallengeRepository;
  let hasher: SecretHasher;
  let inviteeProvider: InviteeAccountProvider;
  let clock: FixedClock;
  let failingAudit: FailingAuditTrail;
  let passwordHash: string;

  beforeAll(async () => {
    clock = new FixedClock(NOW);
    failingAudit = new FailingAuditTrail();
    t = await startTestApp({
      overrides: [
        [CLOCK, clock],
        [AUDIT_TRAIL, failingAudit],
      ],
    });
    failingAudit.delegate = new TypeOrmAuditTrail(
      t.moduleRef.get<TransactionHost<TransactionalAdapterTypeOrm>>(TransactionHost),
      t.moduleRef.get<IdGenerator>(ID_GENERATOR),
    );
    db = t.moduleRef.get(getDataSourceToken());
    bus = t.moduleRef.get(TransactionalCommandBus);
    users = t.moduleRef.get(USER_REPOSITORY);
    challenges = t.moduleRef.get(OTP_CHALLENGE_REPOSITORY);
    hasher = t.moduleRef.get(SECRET_HASHER);
    inviteeProvider = t.moduleRef.get(InviteeAccountProvider);
    passwordHash = await new Argon2PasswordVerifier().rehash('Bastos-Fade-2026');
  });
  afterAll(() => t?.close());

  const issueChallenge = (phone: PhoneNumber, purpose: OtpPurpose, code = '482913') =>
    bus.inTransaction(() =>
      challenges.save(
        OtpChallenge.issue({
          id: randomUUID(),
          phone,
          purpose,
          codeHash: hasher.hash(code),
          now: NOW,
        }),
      ),
    );

  it('creates a single user when two client verifications for the same number arrive simultaneously (T13)', async () => {
    const phone = PhoneNumber.parse('6 94 12 34 56');
    await issueChallenge(phone, OtpPurpose.CLIENT_LOGIN);

    const results = await Promise.allSettled([
      bus.execute(new VerifyClientCode({ phone: phone.value, code: '482913' })),
      bus.execute(new VerifyClientCode({ phone: phone.value, code: '482913' })),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({
      reason: { code: 'OTP_NO_LONGER_VALID' },
    });
    const rows = await db.query(`SELECT id, holder_since AS "holderSince" FROM users WHERE phone = $1`, [
      phone.value,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].holderSince).toEqual(NOW);
  });

  it('creates a single user when a client verification and an owner sign-up for the same number run concurrently (T13)', async () => {
    const phone = PhoneNumber.parse('6 94 00 00 13');
    await issueChallenge(phone, OtpPurpose.CLIENT_LOGIN, '482913');
    await issueChallenge(phone, OtpPurpose.SIGN_UP, '105377');

    const results = await Promise.allSettled([
      bus.execute(new VerifyClientCode({ phone: phone.value, code: '482913' })),
      bus.execute(
        new ConfirmSignUp({
          phone: phone.value,
          code: '105377',
          name: 'Nadège Fotso',
          email: null,
          password: 'Akwa-Tresses-27',
        }),
      ),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    const rows = await db.query(`SELECT id FROM users WHERE phone = $1`, [phone.value]);
    expect(rows).toHaveLength(1);
  });

  it('rolls back the account creation, the audit and the code consumption when an error occurs mid-verification (T14)', async () => {
    const phone = PhoneNumber.parse('6 94 00 00 14');
    await issueChallenge(phone, OtpPurpose.CLIENT_LOGIN, '482913');
    const auditCount = async () =>
      Number((await db.query(`SELECT count(*) AS n FROM audit_log`))[0].n);
    const before = await auditCount();
    failingAudit.failOnAction = 'CLIENT_SIGNED_IN';

    await expect(
      bus.execute(new VerifyClientCode({ phone: phone.value, code: '482913' })),
    ).rejects.toThrow('Panne forcée');

    failingAudit.failOnAction = null;
    expect(await db.query(`SELECT 1 FROM users WHERE phone = $1`, [phone.value])).toEqual([]);
    expect(await auditCount()).toBe(before);
    const [challengeRow] = await db.query(
      `SELECT status, attempts FROM otp_challenges WHERE phone = $1 AND purpose = 'CLIENT_LOGIN'`,
      [phone.value],
    );
    expect(challengeRow).toEqual({ status: 'ACTIVE', attempts: 0 });

    const succeeded = await bus.execute(new VerifyClientCode({ phone: phone.value, code: '482913' }));
    expect(succeeded.maskedPhone).toBe('6 94 •• •• 14');
    expect(await db.query(`SELECT 1 FROM users WHERE phone = $1`, [phone.value])).toHaveLength(1);
    expect(await auditCount()).toBe(before + 2);
  });

  it('updates phone_verified_at and holder_since across client login, sign-up completion, password reset, invitation acceptance and password sign-in (T15)', async () => {
    // 1. Compte client léger recyclé (> 180 j) vérifié par code SMS client
    const jeannePhone = PhoneNumber.parse('6 75 31 42 00');
    const jeanneId = randomUUID();
    await bus.inTransaction(() =>
      users.save(
        User.restore({
          id: jeanneId,
          phone: jeannePhone.value,
          name: null,
          email: null,
          passwordHash: null,
          phoneVerifiedAt: OLD_PROOF,
          holderSince: OLD_PROOF,
          termsAcceptedAt: OLD_PROOF,
          createdAt: OLD_PROOF,
          credentialsVersion: 1,
          version: 0,
        }),
      ),
    );
    await issueChallenge(jeannePhone, OtpPurpose.CLIENT_LOGIN, '482913');
    await bus.execute(new VerifyClientCode({ phone: jeannePhone.value, code: '482913' }));
    expect((await users.findByPhone(jeannePhone))?.snapshot()).toMatchObject({
      phoneVerifiedAt: NOW,
      holderSince: NOW,
    });

    // 2. Compte client léger récent (< 180 j) complété en propriétaire (UC-001) : holder_since conservé, phone_verified_at = NOW
    const aichaPhone = PhoneNumber.parse('6 55 44 33 22');
    await bus.inTransaction(() =>
      users.save(
        User.restore({
          id: randomUUID(),
          phone: aichaPhone.value,
          name: null,
          email: null,
          passwordHash: null,
          phoneVerifiedAt: RECENT_PROOF,
          holderSince: RECENT_PROOF,
          termsAcceptedAt: RECENT_PROOF,
          createdAt: RECENT_PROOF,
          credentialsVersion: 1,
          version: 0,
        }),
      ),
    );
    await issueChallenge(aichaPhone, OtpPurpose.SIGN_UP, '482913');
    await bus.execute(
      new ConfirmSignUp({
        phone: aichaPhone.value,
        code: '482913',
        name: 'Aïcha Mbarga',
        email: null,
        password: 'Akwa-Tresses-27',
      }),
    );
    expect((await users.findByPhone(aichaPhone))?.snapshot()).toMatchObject({
      phoneVerifiedAt: NOW,
      holderSince: RECENT_PROOF,
    });

    // 3. Réinitialisation du mot de passe après > 180 j sans preuve (UC-003) : holder_since avancé à NOW
    const resetPhone = PhoneNumber.parse('6 75 00 00 03');
    await bus.inTransaction(() =>
      users.save(
        User.restore({
          id: randomUUID(),
          phone: resetPhone.value,
          name: 'Paul Ebode',
          email: null,
          passwordHash,
          phoneVerifiedAt: OLD_PROOF,
          holderSince: OLD_PROOF,
          termsAcceptedAt: OLD_PROOF,
          createdAt: OLD_PROOF,
          credentialsVersion: 1,
          version: 0,
        }),
      ),
    );
    await issueChallenge(resetPhone, OtpPurpose.PASSWORD_RESET, '482913');
    await bus.execute(
      new ResetPassword({
        phone: resetPhone.value,
        code: '482913',
        newPassword: 'Wouri-Degrade-2027',
        deviceTokens: [],
      }),
    );
    expect((await users.findByPhone(resetPhone))?.snapshot()).toMatchObject({
      phoneVerifiedAt: NOW,
      holderSince: NOW,
    });

    // 4. Invitation acceptée par un compte du personnel existant après > 180 j (UC-007) : holder_since avancé à provenAt
    const invitePhone = PhoneNumber.parse('6 75 00 00 04');
    await bus.inTransaction(() =>
      users.save(
        User.restore({
          id: randomUUID(),
          phone: invitePhone.value,
          name: 'Clarisse Fotso',
          email: null,
          passwordHash,
          phoneVerifiedAt: OLD_PROOF,
          holderSince: OLD_PROOF,
          termsAcceptedAt: OLD_PROOF,
          createdAt: OLD_PROOF,
          credentialsVersion: 1,
          version: 0,
        }),
      ),
    );
    const proven = ProvenPhone.fromProof(
      PhoneProof.issue({
        id: randomUUID(),
        phone: invitePhone,
        purpose: OtpPurpose.INVITATION,
        tokenHash: 'h:invite',
        now: NOW,
      }),
      NOW,
    )!;
    await bus.inTransaction(() => inviteeProvider.provide({ proven, details: null, now: NOW }));
    expect((await users.findByPhone(invitePhone))?.snapshot()).toMatchObject({
      phoneVerifiedAt: NOW,
      holderSince: NOW,
    });

    // 5. Connexion par mot de passe (UC-002) : date phone_verified_at
    const signInPhone = PhoneNumber.parse('6 75 00 00 05');
    await bus.inTransaction(() =>
      users.save(
        User.restore({
          id: randomUUID(),
          phone: signInPhone.value,
          name: 'Mireille Ndongo',
          email: null,
          passwordHash,
          phoneVerifiedAt: RECENT_PROOF,
          holderSince: RECENT_PROOF,
          termsAcceptedAt: RECENT_PROOF,
          createdAt: RECENT_PROOF,
          credentialsVersion: 1,
          version: 0,
        }),
      ),
    );
    await bus.execute(
      new SignIn({
        phone: signInPhone.value,
        password: 'Bastos-Fade-2026',
        deviceTokens: [],
        networkAddress: '127.0.0.1',
      }),
    );
    expect((await users.findByPhone(signInPhone))?.snapshot()).toMatchObject({
      phoneVerifiedAt: NOW,
      holderSince: RECENT_PROOF,
    });
  });
});
