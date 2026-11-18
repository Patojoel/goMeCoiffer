import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConcurrencyConflictError, ConflictError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { startTestApp, type TestApp } from '../../../../test-support/test-app.js';
import { OtpChallenge } from '../../domain/aggregates/otp-challenge.js';
import { User } from '../../domain/aggregates/user.js';
import { COMMON_PASSWORDS } from '../../domain/ports/common-passwords.port.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../../domain/ports/password-hasher.port.js';
import { SECRET_HASHER, type SecretHasher } from '../../domain/ports/secret-hasher.port.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../domain/repositories/write/otp-challenge.repository.js';
import { USER_REPOSITORY, type UserRepository } from '../../domain/repositories/write/user.repository.js';
import { NewPassword } from '../../domain/value-objects/new-password.js';

const MIREILLE = PhoneNumber.parse('6 77 12 34 56');
const NOW = new Date('2026-11-18T09:00:00Z');
const owner = (id: string, phone = MIREILLE) =>
  User.registerOwner({
    id,
    phone,
    name: 'Mireille Ndongo',
    email: null,
    passwordHash: 'argon-test',
    now: NOW,
  });

describe('Storing accounts and SMS codes in PostgreSQL', () => {
  let t: TestApp;
  let db: DataSource;
  let users: UserRepository;
  let challenges: OtpChallengeRepository;
  let hasher: SecretHasher;

  beforeAll(async () => {
    t = await startTestApp();
    db = t.moduleRef.get(getDataSourceToken());
    users = t.moduleRef.get(USER_REPOSITORY);
    challenges = t.moduleRef.get(OTP_CHALLENGE_REPOSITORY);
    hasher = t.moduleRef.get(SECRET_HASHER);
  });
  afterAll(() => t.close());

  it('reads back a saved account with all its details', async () => {
    await users.save(owner('0195f000-0000-7000-8000-000000000101'));

    expect((await users.findByPhone(MIREILLE))?.snapshot()).toMatchObject({
      id: '0195f000-0000-7000-8000-000000000101',
      phone: '+237677123456',
      name: 'Mireille Ndongo',
      phoneVerifiedAt: NOW,
      version: 1,
    });
  });

  it('never stores two accounts for the same phone number, even when both are written at once', async () => {
    const paul = PhoneNumber.parse('6 99 00 11 22');
    const results = await Promise.allSettled([
      users.save(owner('0195f000-0000-7000-8000-000000000201', paul)),
      users.save(owner('0195f000-0000-7000-8000-000000000202', paul)),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected')).toMatchObject({ reason: expect.any(ConflictError) });
  });

  it('keeps a single active code per number and purpose', async () => {
    const phone = PhoneNumber.parse('6 55 44 33 22');
    const issue = (id: string) =>
      OtpChallenge.issue({ id, phone, purpose: 'SIGN_UP', codeHash: 'x', now: NOW });
    await challenges.save(issue('0195f000-0000-7000-8000-000000000301'));

    await expect(challenges.save(issue('0195f000-0000-7000-8000-000000000302'))).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('refuses to save a code modified meanwhile by another request', async () => {
    const phone = PhoneNumber.parse('6 51 00 00 01');
    await challenges.save(
      OtpChallenge.issue({
        id: '0195f000-0000-7000-8000-000000000401',
        phone,
        purpose: 'SIGN_UP',
        codeHash: hasher.hash('482913'),
        now: NOW,
      }),
    );
    const first = (await challenges.findActive(phone, 'SIGN_UP'))!;
    const second = (await challenges.findActive(phone, 'SIGN_UP'))!;
    first.verify('482913', NOW, hasher);
    second.verify('482913', NOW, hasher);
    await challenges.save(first);

    await expect(challenges.save(second)).rejects.toBeInstanceOf(ConcurrencyConflictError);
  });

  it('stores only a fingerprint of the code, which still recognises the right code', async () => {
    const phone = PhoneNumber.parse('6 52 00 00 02');
    await challenges.save(
      OtpChallenge.issue({
        id: '0195f000-0000-7000-8000-000000000501',
        phone,
        purpose: 'SIGN_UP',
        codeHash: hasher.hash('482913'),
        now: NOW,
      }),
    );

    const [row] = await db.query(`SELECT * FROM otp_challenges WHERE phone = $1`, [phone.value]);
    expect(JSON.stringify(row)).not.toContain('482913');
    expect((await challenges.findActive(phone, 'SIGN_UP'))!.verify('482913', NOW, hasher).accepted).toBe(
      true,
    );
  });

  it('lists the codes sent to a number for one purpose, with their wrong attempts, for the sending limits', async () => {
    const phone = PhoneNumber.parse('6 53 00 00 03');
    const sentAt = new Date('2026-11-18T08:30:00Z');
    const signUp = OtpChallenge.issue({
      id: '0195f000-0000-7000-8000-000000000601',
      phone,
      purpose: 'SIGN_UP',
      codeHash: hasher.hash('482913'),
      now: sentAt,
    });
    signUp.verify('000000', sentAt, hasher);
    signUp.verify('482913', sentAt, hasher);
    await challenges.save(signUp);
    await challenges.save(
      OtpChallenge.issue({
        id: '0195f000-0000-7000-8000-000000000602',
        phone,
        purpose: 'PASSWORD_RESET',
        codeHash: 'x',
        now: sentAt,
      }),
    );

    expect(await challenges.recentSends(phone, 'SIGN_UP', new Date('2026-11-18T08:00:00Z'))).toEqual([
      { sentAt, failedAttempts: 1 },
    ]);
    expect(await challenges.recentSends(phone, 'SIGN_UP', new Date('2026-11-18T08:45:00Z'))).toEqual([]);
  });

  it('hashes passwords with argon2id, never in clear', async () => {
    const password = NewPassword.create('Akwa-Tresses-27', MIREILLE, t.moduleRef.get(COMMON_PASSWORDS));

    const hash = await t.moduleRef.get<PasswordHasher>(PASSWORD_HASHER).hash(password);

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('Akwa-Tresses-27');
  });

  it.each([['MotDePasse2026!'], ['2026motdepasse'], ['1q2w3e4r5t'], ['abcd1234efgh'], ['Azerty-Azerty']])(
    'recognises "%s" as a common password, whatever the case, digits or repetitions around it',
    (candidate) => {
      expect(t.moduleRef.get(COMMON_PASSWORDS).includes(candidate)).toBe(true);
    },
  );

  it('accepts a personal passphrase', () => {
    expect(t.moduleRef.get(COMMON_PASSWORDS).includes('Akwa-Tresses-27')).toBe(false);
  });
});
