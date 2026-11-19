import { randomUUID } from 'node:crypto';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TransactionalCommandBus } from '../../../../shared/application/transactional-command-bus.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { ResetPassword } from '../../application/commands/reset-password/reset-password.command.js';
import { KnownDevice } from '../../domain/aggregates/known-device.js';
import { OtpChallenge } from '../../domain/aggregates/otp-challenge.js';
import { OtpPurpose } from '../../domain/enums/otp-purpose.enum.js';
import { SECRET_HASHER, type SecretHasher } from '../../domain/ports/secret-hasher.port.js';
import { USER_SESSIONS, type UserSessions } from '../../domain/ports/user-sessions.port.js';
import {
  OTP_SEND_HISTORY,
  type OtpSendHistory,
} from '../../domain/repositories/read/otp-send-history.read-repository.js';
import {
  SIGN_IN_ATTEMPT_HISTORY,
  type SignInAttemptHistory,
} from '../../domain/repositories/read/sign-in-attempt-history.read-repository.js';
import {
  KNOWN_DEVICE_REPOSITORY,
  type KnownDeviceRepository,
} from '../../domain/repositories/write/known-device.repository.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../domain/repositories/write/otp-challenge.repository.js';
import {
  SIGN_IN_ATTEMPT_REPOSITORY,
  type SignInAttemptRepository,
} from '../../domain/repositories/write/sign-in-attempt.repository.js';
import { USER_REPOSITORY, type UserRepository } from '../../domain/repositories/write/user.repository.js';
import { assessSignIn } from '../../domain/services/sign-in-attempt-policy.js';

const PAUL = PhoneNumber.parse('6 99 00 11 22');
const NOW = new Date('2026-11-19T10:00:00+01:00');
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);

describe('Storing what a password reset changes, in PostgreSQL', () => {
  let t: TestApp;
  let db: DataSource;
  let bus: TransactionalCommandBus;
  let sessions: UserSessions;
  let attempts: SignInAttemptRepository;
  let history: SignInAttemptHistory;
  let devices: KnownDeviceRepository;
  let challenges: OtpChallengeRepository;
  let sendHistory: OtpSendHistory;
  let users: UserRepository;
  let hasher: SecretHasher;

  const insertUser = async (phone: string) => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO users (id, phone, name, password_hash, created_at, version) VALUES ($1, $2, 'Paul Ebode', 'argon-old', now(), 1)`,
      [id, phone],
    );
    return id;
  };
  const insertSession = (userId: string | null) =>
    db.query(`INSERT INTO sessions (sid, sess, expire) VALUES ($1, $2, now() + interval '1 hour')`, [
      randomUUID(),
      JSON.stringify(userId ? { userId } : { visitor: true }),
    ]);
  const sessionsOf = async (userId: string) =>
    Number((await db.query(`SELECT count(*) AS n FROM sessions WHERE sess->>'userId' = $1`, [userId]))[0].n);

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
    bus = t.moduleRef.get(TransactionalCommandBus);
    sessions = t.moduleRef.get(USER_SESSIONS);
    attempts = t.moduleRef.get(SIGN_IN_ATTEMPT_REPOSITORY);
    history = t.moduleRef.get(SIGN_IN_ATTEMPT_HISTORY);
    devices = t.moduleRef.get(KNOWN_DEVICE_REPOSITORY);
    challenges = t.moduleRef.get(OTP_CHALLENGE_REPOSITORY);
    sendHistory = t.moduleRef.get(OTP_SEND_HISTORY);
    users = t.moduleRef.get(USER_REPOSITORY);
    hasher = t.moduleRef.get(SECRET_HASHER);
  });
  afterAll(() => t.close());

  it('deletes the sessions of one user only, and puts them back when the transaction is cancelled', async () => {
    const paul = await insertUser('+237600000001');
    const mireille = await insertUser('+237600000002');
    await insertSession(paul);
    await insertSession(paul);
    await insertSession(mireille);
    await insertSession(null);

    await expect(
      bus.inTransaction(async () => {
        expect(await sessions.closeAllOf(paul)).toBe(2);
        throw new Error('panne après la fermeture');
      }),
    ).rejects.toThrow('panne');
    expect(await sessionsOf(paul)).toBe(2);

    expect(await bus.inTransaction(() => sessions.closeAllOf(paul))).toBe(2);
    expect(await sessionsOf(paul)).toBe(0);
    expect(await sessionsOf(mireille)).toBe(1);
    expect(
      Number((await db.query(`SELECT count(*) AS n FROM sessions WHERE sess->>'visitor' = 'true'`))[0].n),
    ).toBe(1);
  });

  it('stores the credentials version of an account and raises it at each reset', async () => {
    const id = await insertUser('+237600000003');
    const user = (await users.findByPhone(PhoneNumber.parse('6 00 00 00 03')))!;
    expect(user.credentialsVersion).toBe(1);

    user.resetPassword('argon-new', NOW);
    await bus.inTransaction(() => users.save(user));

    const [row] = await db.query(
      `SELECT credentials_version AS v, password_hash AS h FROM users WHERE id = $1`,
      [id],
    );
    expect(row).toEqual({ v: 2, h: 'argon-new' });
  });

  it('keeps the reset mark in the attempt history, which lifts the blocks of the number', async () => {
    const failures = [9, 8, 7, 6, 5];
    for (const m of failures)
      await attempts.add({
        phone: PAUL.value,
        networkAddress: '41.202.10.1',
        at: minutesAgo(m),
        succeeded: false,
        fromKnownDevice: false,
      });
    const assess = async () =>
      assessSignIn({
        phone: PAUL.value,
        networkAddress: '41.202.10.1',
        attempts: await history.recentAttempts(PAUL, '41.202.10.1', NOW),
        fromKnownDevice: false,
        now: NOW,
      });
    expect(await assess()).toMatchObject({ reason: 'PHONE_SHORT' });

    await attempts.add({
      phone: PAUL.value,
      networkAddress: '',
      at: minutesAgo(1),
      succeeded: true,
      fromKnownDevice: false,
      passwordReset: true,
    });

    expect(await assess()).toBeNull();
    const marks = (await history.recentAttempts(PAUL, '41.202.10.1', NOW)).filter((a) => a.passwordReset);
    expect(marks).toHaveLength(1);
  });

  it('lists only the devices of the account that are still recognised, and keeps a revocation', async () => {
    const paul = await insertUser('+237600000004');
    const mireille = await insertUser('+237600000005');
    const recognize = (userId: string, token: string) =>
      devices.save(
        KnownDevice.recognize({
          id: randomUUID(),
          userId,
          tokenHash: hasher.hash(token),
          now: minutesAgo(60),
        }),
      );
    await recognize(paul, 'phone');
    await recognize(paul, 'tablet');
    await recognize(mireille, 'mireille');

    for (const device of await devices.findNotRevokedOf(paul)) {
      device.revoke(NOW);
      await devices.save(device);
    }

    expect(await devices.findNotRevokedOf(paul)).toEqual([]);
    expect(await devices.findNotRevokedOf(mireille)).toHaveLength(1);
  });

  it('lets only one of two simultaneous confirmations of the same code succeed', async () => {
    const phone = PhoneNumber.parse('6 00 00 00 07');
    await insertUser(phone.value);
    await bus.inTransaction(() =>
      challenges.save(
        OtpChallenge.issue({
          id: randomUUID(),
          phone,
          purpose: OtpPurpose.PASSWORD_RESET,
          codeHash: hasher.hash('482913'),
          now: new Date(),
        }),
      ),
    );
    const confirm = () =>
      bus.execute(
        new ResetPassword({
          phone: phone.value,
          code: '482913',
          newPassword: 'Wouri-Degrade-2027',
          deviceTokens: [],
        }),
      );

    const results = await Promise.all([confirm(), confirm()]);

    expect(results.map((r) => r.status).sort()).toEqual(['PASSWORD_RESET', 'REFUSED']);
    expect(results.find((r) => r.status === 'REFUSED')).toMatchObject({
      refusal: { code: 'OTP_NO_LONGER_VALID' },
    });
    const [row] = await db.query(`SELECT credentials_version AS v FROM users WHERE phone = $1`, [
      phone.value,
    ]);
    expect(row.v).toBe(2);
  });
});
