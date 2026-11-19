import { beforeEach, describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { RequestPasswordResetCode } from '../../application/commands/request-password-reset-code/request-password-reset-code.command.js';
import { RequestPasswordResetCodeHandler } from '../../application/commands/request-password-reset-code/request-password-reset-code.handler.js';
import { ResetPassword } from '../../application/commands/reset-password/reset-password.command.js';
import { ResetPasswordHandler } from '../../application/commands/reset-password/reset-password.handler.js';
import type { ResetPasswordResponse } from '../../application/commands/reset-password/reset-password.response.js';
import { KnownDeviceRegistry } from '../../application/services/known-device-registry.js';
import { OtpChallenge } from '../../domain/aggregates/otp-challenge.js';
import { KnownDevice } from '../../domain/aggregates/known-device.js';
import { assessSignIn } from '../../domain/services/sign-in-attempt-policy.js';
import type { SignInAttempt } from '../../domain/value-objects/sign-in-attempt.js';
import {
  commonPasswords,
  FakeAfterCommit,
  fakePasswordHasher,
  fakeSecretHasher,
  FixedDeviceTokens,
  FixedOtpCodes,
  InMemoryAuditTrail,
  InMemoryKnownDeviceRepository,
  InMemoryOtpChallengeRepository,
  InMemoryOtpSendHistory,
  InMemoryRealtime,
  InMemorySignInAttemptHistory,
  InMemorySignInAttemptRepository,
  InMemorySmsSender,
  InMemoryUserRepository,
  InMemoryUserSessions,
} from '../fakes/identity-fakes.js';

const at = (time: string) => new Date(`2026-11-19T${time}+01:00`);
const PAUL = '6 99 00 11 22';
const PAUL_E164 = '+237699001122';
const PAUL_ID = '0195f000-0000-7000-8000-00000000a001';
const MIREILLE = '6 77 12 34 56';
const MIREILLE_ID = '0195f000-0000-7000-8000-00000000a002';
const AICHA = '6 55 44 33 22';
const NOBODY = '6 70 00 00 01';
const NEW_PASSWORD = 'Wouri-Degrade-2027';

describe('Resetting a forgotten password with a code received by SMS', () => {
  let clock: FixedClock;
  let users: InMemoryUserRepository;
  let challenges: InMemoryOtpChallengeRepository;
  let attempts: InMemorySignInAttemptRepository;
  let devices: InMemoryKnownDeviceRepository;
  let sessions: InMemoryUserSessions;
  let realtime: InMemoryRealtime;
  let audit: InMemoryAuditTrail;
  let sms: InMemorySmsSender;
  let afterCommit: FakeAfterCommit;
  let requestCode: RequestPasswordResetCodeHandler;
  let reset: ResetPasswordHandler;

  beforeEach(() => {
    clock = new FixedClock(at('10:00:00'));
    users = new InMemoryUserRepository();
    users.seedStaff(PAUL_ID, PhoneNumber.parse(PAUL), 'argon:Bastos-Fade-2026');
    users.seedStaff(MIREILLE_ID, PhoneNumber.parse(MIREILLE), 'argon:Akwa-Tresses-27');
    users.seedLightClient('0195f000-0000-7000-8000-00000000a003', PhoneNumber.parse(AICHA));
    challenges = new InMemoryOtpChallengeRepository();
    attempts = new InMemorySignInAttemptRepository();
    devices = new InMemoryKnownDeviceRepository();
    sessions = new InMemoryUserSessions();
    realtime = new InMemoryRealtime();
    audit = new InMemoryAuditTrail();
    sms = new InMemorySmsSender();
    afterCommit = new FakeAfterCommit();
    const ids = new SequentialIdGenerator();
    requestCode = new RequestPasswordResetCodeHandler(
      users,
      challenges,
      new InMemoryOtpSendHistory(challenges),
      new FixedOtpCodes(['482913', '105377']),
      fakeSecretHasher,
      sms,
      afterCommit.asAfterCommit(),
      clock,
      ids,
    );
    const registry = new KnownDeviceRegistry(
      devices,
      fakeSecretHasher,
      new FixedDeviceTokens(['fresh-1', 'fresh-2']),
      ids,
    );
    reset = new ResetPasswordHandler(
      users,
      challenges,
      attempts,
      registry,
      sessions,
      realtime,
      fakeSecretHasher,
      fakePasswordHasher,
      commonPasswords,
      audit,
      clock,
    );
  });

  const receiveCode = async (phone: string) => {
    await requestCode.execute(new RequestPasswordResetCode(phone));
    await afterCommit.commit();
  };
  const confirm = (
    code: string,
    over: { phone?: string; password?: string; deviceTokens?: string[] } = {},
  ): Promise<ResetPasswordResponse> =>
    reset.execute(
      new ResetPassword({
        phone: over.phone ?? PAUL,
        code,
        newPassword: over.password ?? NEW_PASSWORD,
        deviceTokens: over.deviceTokens ?? [],
      }),
    );
  const paul = () => users.all().find((u) => u.id === PAUL_ID)!;
  const refusalCode = (response: ResetPasswordResponse) =>
    response.status === 'REFUSED' ? response.refusal.code : null;

  describe('refusals', () => {
    it('refuses a code nobody asked for, the same way for any number', async () => {
      const response = await confirm('482913');

      expect(refusalCode(response)).toBe('OTP_NO_LONGER_VALID');
      expect(paul().passwordHash).toBe('argon:Bastos-Fade-2026');
    });

    it.each([
      ['too short', 'salon2026', 'PASSWORD_TOO_SHORT'],
      ['too common', 'motdepasse123', 'PASSWORD_TOO_COMMON'],
      ['containing the phone number', '699001122ab', 'PASSWORD_CONTAINS_PHONE'],
    ])(
      'refuses a password that is %s, without using the code or an attempt',
      async (_why, password, code) => {
        await receiveCode(PAUL);

        await expect(confirm('482913', { password })).rejects.toMatchObject({ code });
        expect(challenges.all()[0]).toMatchObject({ attempts: 0, status: 'ACTIVE' });
        expect(await confirm('482913')).toMatchObject({ status: 'PASSWORD_RESET' });
      },
    );

    it('refuses a wrong code, counts the attempt, and keeps the password', async () => {
      await receiveCode(PAUL);

      const response = await confirm('111111');

      expect(response).toMatchObject({ status: 'REFUSED', refusal: { code: 'OTP_INCORRECT' } });
      expect(challenges.all()[0]).toMatchObject({ attempts: 1, status: 'ACTIVE' });
      expect(paul().passwordHash).toBe('argon:Bastos-Fade-2026');
      expect(paul().credentialsVersion).toBe(1);
    });

    it('accepts the code until 4 min 59 s after it was sent', async () => {
      await receiveCode(PAUL);
      clock.set(at('10:04:59'));

      expect(await confirm('482913')).toMatchObject({ status: 'PASSWORD_RESET' });
    });

    it('refuses the code at the very second it expires', async () => {
      await receiveCode(PAUL);
      clock.set(at('10:05:00'));

      expect(refusalCode(await confirm('482913'))).toBe('OTP_EXPIRED');
    });

    it('refuses the right code after 5 wrong ones', async () => {
      await receiveCode(PAUL);
      for (const wrong of ['100001', '100002', '100003', '100004', '100005']) await confirm(wrong);

      expect(refusalCode(await confirm('482913'))).toBe('OTP_ATTEMPTS_EXHAUSTED');
      expect(paul().passwordHash).toBe('argon:Bastos-Fade-2026');
    });

    it('refuses the code of a request that a newer request cancelled', async () => {
      await receiveCode(PAUL);
      clock.advanceMinutes(1);
      await receiveCode(PAUL);

      const response = await confirm('482913');

      expect(response).toMatchObject({ status: 'REFUSED', refusal: { code: 'OTP_INCORRECT' } });
    });

    it('refuses a sign-up code for a password reset', async () => {
      await challenges.save(
        OtpChallenge.issue({
          id: 'sign-up',
          phone: PhoneNumber.parse(PAUL),
          purpose: 'SIGN_UP',
          codeHash: fakeSecretHasher.hash('482913'),
          now: clock.now(),
        }),
      );

      expect(refusalCode(await confirm('482913'))).toBe('OTP_NO_LONGER_VALID');
    });

    it.each([
      ['a light client account', AICHA],
      ['a number with no account', NOBODY],
    ])('never lets any code choose a password for %s', async (_label, phone) => {
      await receiveCode(phone);

      const response = await confirm('482913', { phone });

      expect(response).toMatchObject({ status: 'REFUSED', refusal: { code: 'OTP_INCORRECT' } });
      expect(users.all().filter((u) => u.passwordHash === `argon:${NEW_PASSWORD}`)).toEqual([]);
    });
  });

  it('keeps counting the wrong codes typed on a request whose SMS failed, toward the 10 wrong codes a day', async () => {
    sms.outage = true;
    for (let round = 0; round < 2; round++) {
      await receiveCode(PAUL);
      for (const wrong of ['100001', '100002', '100003', '100004', '100005']) await confirm(wrong);
      clock.advanceMinutes(1);
    }

    await expect(receiveCode(PAUL)).rejects.toMatchObject({ code: 'OTP_TOO_MANY_REQUESTS' });
  });

  describe('a successful reset', () => {
    beforeEach(async () => {
      await receiveCode(PAUL);
      clock.set(at('10:02:00'));
    });

    it('replaces the password, bumps the credentials version and verifies the number at that instant', async () => {
      const response = await confirm('482913');

      expect(response).toMatchObject({ status: 'PASSWORD_RESET', userId: PAUL_ID, credentialsVersion: 2 });
      expect(paul()).toMatchObject({
        passwordHash: `argon:${NEW_PASSWORD}`,
        credentialsVersion: 2,
        phoneVerifiedAt: at('10:02:00'),
      });
    });

    it('does not compare the new password with the current one', async () => {
      const response = await confirm('482913', { password: 'Bastos-Fade-2026' });

      expect(response).toMatchObject({ status: 'PASSWORD_RESET' });
    });

    it('uses the code only once', async () => {
      await confirm('482913');

      expect(refusalCode(await confirm('482913'))).toBe('OTP_NO_LONGER_VALID');
    });

    it('closes every session of this user and of nobody else', async () => {
      sessions.opened(PAUL_ID, 3);
      sessions.opened(MIREILLE_ID, 1);

      await confirm('482913');

      expect(sessions.openCountOf(PAUL_ID)).toBe(0);
      expect(sessions.openCountOf(MIREILLE_ID)).toBe(1);
    });

    it('closes the open realtime streams of this user after a reset, and only then', async () => {
      await confirm('111111');
      expect(realtime.closedUsers).toEqual([]);

      await confirm('482913');

      expect(realtime.closedUsers).toEqual([PAUL_ID]);
    });

    it('lifts the blocks of the phone number, not the ones entered after the reset', async () => {
      const failure = (time: string): SignInAttempt => ({
        phone: PAUL_E164,
        networkAddress: '41.202.10.1',
        at: at(time),
        succeeded: false,
        fromKnownDevice: false,
      });
      for (const time of ['09:55:00', '09:56:00', '09:57:00', '09:58:00', '09:59:00'])
        await attempts.add(failure(time));
      const history = new InMemorySignInAttemptHistory(attempts);
      const assess = async (now: Date) =>
        assessSignIn({
          phone: PAUL_E164,
          networkAddress: '41.202.10.1',
          attempts: await history.recentAttempts(PhoneNumber.parse(PAUL), '41.202.10.1', now),
          fromKnownDevice: false,
          now,
        });
      expect(await assess(at('10:02:00'))).toMatchObject({ reason: 'PHONE_SHORT' });

      await confirm('482913');

      expect(await assess(at('10:02:00'))).toBeNull();
    });

    it('forgets the previously recognised devices of this user, and recognises the one of the reset', async () => {
      const recognize = async (id: string, userId: string, token: string) =>
        devices.save(
          KnownDevice.recognize({ id, userId, tokenHash: fakeSecretHasher.hash(token), now: at('09:00:00') }),
        );
      await recognize('phone', PAUL_ID, 'phone-token');
      await recognize('tablet', PAUL_ID, 'tablet-token');
      await recognize('mireille-phone', MIREILLE_ID, 'mireille-token');

      const response = await confirm('482913', { deviceTokens: ['tablet-token'] });

      const recognised = (id: string) =>
        KnownDevice.restore(devices.all().find((d) => d.id === id)!).isRecognizedAt(clock.now());
      expect(recognised('phone')).toBe(false);
      expect(recognised('tablet')).toBe(true);
      expect(recognised('mireille-phone')).toBe(true);
      expect(response).toMatchObject({ deviceTokens: ['fresh-1'] });
    });

    it('recognises a browser that had no recognised device yet', async () => {
      await confirm('482913');

      expect(devices.all()).toHaveLength(1);
      expect(devices.all()[0]).toMatchObject({ userId: PAUL_ID, revokedAt: null });
    });

    it('traces the reset and the sign-in without any secret, number or address', async () => {
      sessions.opened(PAUL_ID, 2);

      await confirm('482913');

      expect(audit.entries.map((e) => e.action)).toEqual(['PASSWORD_RESET', 'USER_SIGNED_IN']);
      expect(audit.entries[0]).toMatchObject({
        subjectId: PAUL_ID,
        actorUserId: PAUL_ID,
        occurredAt: at('10:02:00'),
        details: { sessionsClosed: 2 },
      });
      const trace = JSON.stringify(audit.entries);
      for (const secret of ['482913', NEW_PASSWORD, '699001122', '41.202'])
        expect(trace).not.toContain(secret);
    });
  });
});
