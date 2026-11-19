import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { SignIn } from '../../application/commands/sign-in/sign-in.command.js';
import { SignInHandler } from '../../application/commands/sign-in/sign-in.handler.js';
import type { SignInResponse } from '../../application/commands/sign-in/sign-in.response.js';
import { KnownDeviceRegistry } from '../../application/services/known-device-registry.js';
import { KnownDevice } from '../../domain/aggregates/known-device.js';
import type { SignInAttempt } from '../../domain/value-objects/sign-in-attempt.js';
import {
  fakeSecretHasher,
  FakePasswordVerifier,
  FixedDeviceTokens,
  InMemoryAuditTrail,
  InMemoryKnownDeviceRepository,
  InMemorySignInAttemptHistory,
  InMemorySignInAttemptRepository,
  InMemoryUserRepository,
} from '../fakes/identity-fakes.js';

const at = (time: string, day = '18') => new Date(`2026-11-${day}T${time}+01:00`);
const PAUL = '6 99 00 11 22';
const PAUL_E164 = '+237699001122';
const PAUL_ID = '0195f000-0000-7000-8000-00000000a001';
const MIREILLE = '6 77 12 34 56';
const MIREILLE_ID = '0195f000-0000-7000-8000-00000000a002';
const AICHA = '6 55 44 33 22';
const NOBODY = '6 70 00 00 01';
const GOOD = 'Bastos-Fade-2026';
const HOME = '41.202.10.1';

describe('Signing in with a phone number and a password', () => {
  let clock: FixedClock;
  let users: InMemoryUserRepository;
  let attempts: InMemorySignInAttemptRepository;
  let devices: InMemoryKnownDeviceRepository;
  let verifier: FakePasswordVerifier;
  let audit: InMemoryAuditTrail;
  let handler: SignInHandler;
  let hashCalls: number;

  beforeEach(() => {
    clock = new FixedClock(at('10:00:00'));
    users = new InMemoryUserRepository();
    users.seedStaff(PAUL_ID, PhoneNumber.parse(PAUL), `argon:${GOOD}`);
    users.seedStaff(MIREILLE_ID, PhoneNumber.parse(MIREILLE), 'argon:Akwa-Tresses-27');
    users.seedLightClient('0195f000-0000-7000-8000-00000000a003', PhoneNumber.parse(AICHA));
    attempts = new InMemorySignInAttemptRepository();
    devices = new InMemoryKnownDeviceRepository();
    verifier = new FakePasswordVerifier();
    audit = new InMemoryAuditTrail();
    hashCalls = 0;
    const countingHasher = {
      hash: (secret: string) => {
        hashCalls += 1;
        return fakeSecretHasher.hash(secret);
      },
      matches: fakeSecretHasher.matches,
    };
    const registry = new KnownDeviceRegistry(
      devices,
      countingHasher,
      new FixedDeviceTokens(Array.from({ length: 30 }, (_, i) => `tok-${i + 1}`)),
      new SequentialIdGenerator(),
    );
    handler = new SignInHandler(
      users,
      attempts,
      new InMemorySignInAttemptHistory(attempts),
      registry,
      verifier,
      audit,
      clock,
    );
  });

  const signIn = (
    phone: string,
    password: string,
    over: { tokens?: readonly string[]; address?: string } = {},
  ) =>
    handler.execute(
      new SignIn({
        phone,
        password,
        deviceTokens: over.tokens ?? [],
        networkAddress: over.address ?? HOME,
      }),
    );
  const refusalOf = (result: SignInResponse) =>
    result.status === 'REFUSED' ? { code: result.refusal.code, message: result.refusal.message } : result;
  const priorFailures = (phone: string, times: string[], over: Partial<SignInAttempt> = {}, day = '18') =>
    Promise.all(
      times.map((time) =>
        attempts.add({
          phone: PhoneNumber.parse(phone).value,
          networkAddress: HOME,
          at: at(time, day),
          succeeded: false,
          fromKnownDevice: false,
          ...over,
        }),
      ),
    );
  const rememberDevice = (userId: string, token: string, recognizedAt: Date) =>
    devices.save(
      KnownDevice.recognize({
        id: `dev-${userId}-${token}`,
        userId,
        tokenHash: `h:${token}`,
        now: recognizedAt,
      }),
    );
  const FIVE_WRONG = ['09:55:00', '09:56:00', '09:57:00', '09:58:00', '09:59:00'];

  describe('refusals', () => {
    it.each([
      ['a number without an account', NOBODY, GOOD],
      ['a light client account, which has no password', AICHA, GOOD],
      ['a wrong password', PAUL, 'Akwa-Fade-2026'],
    ])(
      'refuses %s with the same message, after exactly one password verification',
      async (_, phone, password) => {
        const result = await signIn(phone, password);

        expect(refusalOf(result)).toEqual({
          code: 'INVALID_CREDENTIALS',
          message: 'Numéro ou mot de passe incorrect.',
        });
        expect(verifier.verifications).toBe(1);
        expect(attempts.all()).toEqual([
          {
            phone: PhoneNumber.parse(phone).value,
            networkAddress: HOME,
            at: at('10:00:00'),
            succeeded: false,
            fromKnownDevice: false,
          },
        ]);
      },
    );

    it('refuses a malformed number without verifying anything or counting an attempt', async () => {
      await expect(signIn('6 99 00 11 2', GOOD)).rejects.toThrow(InvalidValueError);

      expect(verifier.verifications).toBe(0);
      expect(attempts.all()).toEqual([]);
    });

    it('refuses a number blocked after 5 wrong passwords, even with the right password and without verifying it', async () => {
      await priorFailures(PAUL, FIVE_WRONG);

      const result = await signIn(PAUL, GOOD);

      expect(refusalOf(result)).toEqual({
        code: 'SIGN_IN_TEMPORARILY_BLOCKED',
        message:
          "Trop d'essais pour ce numéro. Réessayez dans 14 minutes ou utilisez « Mot de passe oublié ».",
      });
      expect(verifier.verifications).toBe(0);
      expect(attempts.all()).toHaveLength(5);
    });

    it('blocks a number without an account exactly like a registered one', async () => {
      await priorFailures(NOBODY, FIVE_WRONG);

      const result = await signIn(NOBODY, GOOD);

      expect(refusalOf(result)).toEqual({
        code: 'SIGN_IN_TEMPORARILY_BLOCKED',
        message:
          "Trop d'essais pour ce numéro. Réessayez dans 14 minutes ou utilisez « Mot de passe oublié ».",
      });
      expect(verifier.verifications).toBe(0);
    });

    it('lets the number sign in again 15 minutes after the 5th wrong password, to the second', async () => {
      await priorFailures(PAUL, ['10:00:00', '10:01:00', '10:02:00', '10:03:00', '10:04:00']);

      clock.set(at('10:18:59'));
      const tooEarly = await signIn(PAUL, GOOD);
      clock.set(at('10:19:00'));
      const onTime = await signIn(PAUL, GOOD);

      expect(refusalOf(tooEarly)).toMatchObject({ code: 'SIGN_IN_TEMPORARILY_BLOCKED' });
      expect(onTime.status).toBe('SIGNED_IN');
    });

    it('tells to wait until tomorrow once 20 wrong passwords were typed within 24 hours', async () => {
      const everyTwentyMinutes = Array.from(
        { length: 20 },
        (_, i) => new Date(at('11:00:00', '17').getTime() + i * 20 * 60_000),
      );
      await Promise.all(
        everyTwentyMinutes.map((date) =>
          attempts.add({
            phone: PAUL_E164,
            networkAddress: '10.0.0.5',
            at: date,
            succeeded: false,
            fromKnownDevice: false,
          }),
        ),
      );

      const result = await signIn(PAUL, GOOD);

      expect(refusalOf(result)).toEqual({
        code: 'SIGN_IN_TEMPORARILY_BLOCKED',
        message:
          "Trop d'essais pour ce numéro aujourd'hui. Utilisez « Mot de passe oublié » ou réessayez demain.",
      });
    });

    it('blocks a network address after 30 failures within the hour, whatever the numbers', async () => {
      await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          attempts.add({
            phone: `+2376000000${String(i).padStart(2, '0')}`,
            networkAddress: HOME,
            at: at('09:10:00'),
            succeeded: false,
            fromKnownDevice: false,
          }),
        ),
      );

      const result = await signIn(PAUL, GOOD);

      expect(refusalOf(result)).toEqual({
        code: 'SIGN_IN_TEMPORARILY_BLOCKED',
        message:
          "Trop d'essais depuis ce réseau. Réessayez dans une heure ou connectez-vous depuis votre appareil habituel.",
      });
    });
  });

  it('counts the failures of one IPv6 /64 together, whatever the address used inside it', async () => {
    for (let i = 10; i < 40; i++)
      await signIn(`6 70 00 00 ${i}`, 'wrong-password', { address: `2001:db8:1:2::${i.toString(16)}` });

    const result = await signIn(PAUL, GOOD, { address: '2001:db8:1:2:ffff::9' });

    expect(refusalOf(result)).toMatchObject({ code: 'SIGN_IN_TEMPORARILY_BLOCKED' });
    expect((await signIn(PAUL, GOOD, { address: '2001:db8:1:3::1' })).status).toBe('SIGNED_IN');
  });

  describe('a successful sign-in', () => {
    it('opens the way for the right password, records the success and traces it without any secret', async () => {
      const result = await signIn(PAUL, GOOD);

      expect(result).toEqual({ status: 'SIGNED_IN', userId: PAUL_ID, credentialsVersion: 1, deviceTokens: ['tok-1'] });
      expect(verifier.verifications).toBe(1);
      expect(attempts.all()).toEqual([
        {
          phone: PAUL_E164,
          networkAddress: HOME,
          at: at('10:00:00'),
          succeeded: true,
          fromKnownDevice: false,
        },
      ]);
      expect(audit.entries).toEqual([
        {
          action: 'USER_SIGNED_IN',
          subjectType: 'user',
          subjectId: PAUL_ID,
          actorUserId: PAUL_ID,
          occurredAt: at('10:00:00'),
          details: { knownDevice: false },
        },
      ]);
      expect(JSON.stringify(audit.entries)).not.toMatch(/6 ?99|HOME|41\.202|Bastos|tok-1/);
    });

    it('forgets the earlier wrong passwords, so that the number is not blocked afterwards', async () => {
      await priorFailures(PAUL, ['09:50:00', '09:51:00', '09:52:00', '09:53:00']);
      clock.set(at('09:54:00'));
      await signIn(PAUL, GOOD);

      clock.set(at('10:00:00'));
      for (const wrong of ['a', 'b', 'c', 'd']) await signIn(PAUL, wrong);
      const result = await signIn(PAUL, GOOD);

      expect(result.status).toBe('SIGNED_IN');
    });

    it('strengthens a password hash computed with outdated settings, keeping the same password', async () => {
      users.seedStaff(PAUL_ID, PhoneNumber.parse(PAUL), `argon-old:${GOOD}`);

      await signIn(PAUL, GOOD);

      expect((await users.findByPhone(PhoneNumber.parse(PAUL)))?.passwordHash).toBe(`argon:${GOOD}`);
      expect((await signIn(PAUL, GOOD)).status).toBe('SIGNED_IN');
    });

    it('leaves a hash with current settings as it is', async () => {
      const before = (await users.findByPhone(PhoneNumber.parse(PAUL)))?.snapshot().version;

      await signIn(PAUL, GOOD);

      expect((await users.findByPhone(PhoneNumber.parse(PAUL)))?.snapshot().version).toBe(before);
    });

    it('does not strengthen anything after a wrong password', async () => {
      users.seedStaff(PAUL_ID, PhoneNumber.parse(PAUL), `argon-old:${GOOD}`);

      await signIn(PAUL, 'wrong-password');

      expect((await users.findByPhone(PhoneNumber.parse(PAUL)))?.passwordHash).toBe(`argon-old:${GOOD}`);
    });
  });

  describe('the blocking of a number is traced for an existing account only', () => {
    it('traces the block that the 5th wrong password raises, without the phone number', async () => {
      await priorFailures(PAUL, ['09:55:00', '09:56:00', '09:57:00', '09:58:00']);

      await signIn(PAUL, 'wrong-password');

      expect(audit.entries).toEqual([
        {
          action: 'SIGN_IN_BLOCKED',
          subjectType: 'user',
          subjectId: PAUL_ID,
          actorUserId: null,
          occurredAt: at('10:00:00'),
        },
      ]);
    });

    it('traces nothing for a number without an account', async () => {
      await priorFailures(NOBODY, ['09:55:00', '09:56:00', '09:57:00', '09:58:00']);

      await signIn(NOBODY, 'wrong-password');

      expect(audit.entries).toEqual([]);
    });

    it('does not trace the refused attempts made during the block', async () => {
      await priorFailures(PAUL, FIVE_WRONG);

      await signIn(PAUL, 'wrong-password');

      expect(audit.entries).toEqual([]);
    });
  });

  describe('recognised devices', () => {
    it('lets Paul in from his usual phone while a stranger has blocked his number', async () => {
      await rememberDevice(PAUL_ID, 'usual', at('10:00:00', '10'));
      await priorFailures(PAUL, FIVE_WRONG);

      const result = await signIn(PAUL, GOOD, { tokens: ['usual'] });

      expect(result).toEqual({ status: 'SIGNED_IN', userId: PAUL_ID, credentialsVersion: 1, deviceTokens: ['tok-1'] });
      expect(audit.entries[0]?.details).toEqual({ knownDevice: true });
    });

    it('lets Paul in from his usual phone while a stranger exhausted the network address', async () => {
      await rememberDevice(PAUL_ID, 'usual', at('10:00:00', '10'));
      await Promise.all(
        Array.from({ length: 30 }, (_, i) =>
          attempts.add({
            phone: `+2376000000${String(i).padStart(2, '0')}`,
            networkAddress: HOME,
            at: at('09:10:00'),
            succeeded: false,
            fromKnownDevice: false,
          }),
        ),
      );

      expect((await signIn(PAUL, GOOD, { tokens: ['usual'] })).status).toBe('SIGNED_IN');
    });

    it('does not block the number for the wrong passwords typed on the usual phone, but stops recognising that phone at the 5th', async () => {
      await rememberDevice(PAUL_ID, 'usual', at('10:00:00', '10'));
      for (let i = 0; i < 5; i++) await signIn(PAUL, 'wrong-password', { tokens: ['usual'] });

      const fromNewDevice = await signIn(PAUL, GOOD);

      expect(fromNewDevice.status).toBe('SIGNED_IN');
      expect(devices.all()[0]?.revokedAt).toEqual(at('10:00:00'));
    });

    it('treats a phone that reached 5 wrong passwords as a new device', async () => {
      await rememberDevice(PAUL_ID, 'usual', at('10:00:00', '10'));
      for (let i = 0; i < 5; i++) await signIn(PAUL, 'wrong-password', { tokens: ['usual'] });
      await priorFailures(PAUL, FIVE_WRONG);

      const result = await signIn(PAUL, GOOD, { tokens: ['usual'] });

      expect(refusalOf(result)).toMatchObject({ code: 'SIGN_IN_TEMPORARILY_BLOCKED' });
    });

    it('keeps recognising the usual phone after 4 wrong passwords, and starts counting again after a success', async () => {
      await rememberDevice(PAUL_ID, 'usual', at('10:00:00', '10'));
      for (let i = 0; i < 4; i++) await signIn(PAUL, 'wrong-password', { tokens: ['usual'] });
      await signIn(PAUL, GOOD, { tokens: ['usual'] });
      for (let i = 0; i < 4; i++) await signIn(PAUL, 'wrong-password', { tokens: ['tok-1'] });

      expect(devices.all()[0]).toMatchObject({ failedAttempts: 4, revokedAt: null });
    });

    it.each([
      ['2026-11-17T09:59:59+01:00', 'SIGNED_IN'],
      ['2026-11-17T10:00:00+01:00', 'REFUSED'],
    ])(
      'recognises a phone last used on 19/08/2026 at 10:00 until 90 days later: at %s, %s',
      async (instant, expected) => {
        await rememberDevice(PAUL_ID, 'usual', new Date('2026-08-19T10:00:00+01:00'));
        await priorFailures(PAUL, FIVE_WRONG, {}, '17');
        clock.set(new Date(instant));

        const result = await signIn(PAUL, GOOD, { tokens: ['usual'] });

        expect(result.status).toBe(expected);
      },
    );

    it('prolongs the recognition for 90 days from each successful sign-in', async () => {
      await rememberDevice(PAUL_ID, 'usual', at('10:00:00', '10'));

      await signIn(PAUL, GOOD, { tokens: ['usual'] });

      expect(devices.all()[0]?.expiresAt).toEqual(new Date('2027-02-16T10:00:00+01:00'));
    });

    it("recognises a phone for one account only: Mireille's usual phone does not exempt Paul", async () => {
      await rememberDevice(MIREILLE_ID, 'tablet', at('10:00:00', '10'));
      await priorFailures(PAUL, FIVE_WRONG);

      const result = await signIn(PAUL, GOOD, { tokens: ['tablet'] });

      expect(refusalOf(result)).toMatchObject({ code: 'SIGN_IN_TEMPORARILY_BLOCKED' });
    });

    it('recognises the shared salon tablet separately for each account, each with its own token in the cookie', async () => {
      await rememberDevice(MIREILLE_ID, 'tablet', at('10:00:00', '10'));

      const paulOnTablet = await signIn(PAUL, GOOD, { tokens: ['tablet'] });
      clock.set(at('10:10:00'));
      const LATER_WRONG = ['10:05:00', '10:06:00', '10:07:00', '10:08:00', '10:09:00'];
      await priorFailures(PAUL, LATER_WRONG);
      await priorFailures(MIREILLE, LATER_WRONG);
      const cookie = paulOnTablet.status === 'SIGNED_IN' ? paulOnTablet.deviceTokens : [];
      const withoutCookie = await signIn(PAUL, GOOD);
      const paulAgain = await signIn(PAUL, GOOD, { tokens: cookie });
      const mireilleAgain = await signIn(MIREILLE, 'Akwa-Tresses-27', { tokens: cookie });

      expect(cookie).toEqual(['tablet', 'tok-1']);
      expect(paulAgain.status).toBe('SIGNED_IN');
      expect(mireilleAgain.status).toBe('SIGNED_IN');
      expect(refusalOf(withoutCookie)).toMatchObject({ code: 'SIGN_IN_TEMPORARILY_BLOCKED' });
      expect(
        devices
          .all()
          .map((d) => d.userId)
          .sort(),
      ).toEqual([MIREILLE_ID, PAUL_ID].sort());
    });

    it('replaces the token of the account at each successful sign-in, in place in the cookie', async () => {
      await rememberDevice(MIREILLE_ID, 'tablet', at('10:00:00', '10'));
      await rememberDevice(PAUL_ID, 'paul-phone', at('10:00:00', '10'));

      const result = await signIn(MIREILLE, 'Akwa-Tresses-27', { tokens: ['paul-phone', 'tablet'] });

      expect(result).toEqual({
        status: 'SIGNED_IN',
        userId: MIREILLE_ID,
        credentialsVersion: 1,
        deviceTokens: ['paul-phone', 'tok-1'],
      });
      expect(
        devices
          .all()
          .map((d) => d.tokenHash)
          .sort(),
      ).toEqual(['h:paul-phone', 'h:tok-1']);
    });

    it('stops recognising a copied token once its owner has signed in again', async () => {
      await rememberDevice(MIREILLE_ID, 'tablet', at('10:00:00', '10'));
      await signIn(MIREILLE, 'Akwa-Tresses-27', { tokens: ['tablet'] });
      clock.set(at('10:10:00'));
      await priorFailures(MIREILLE, ['10:05:00', '10:06:00', '10:07:00', '10:08:00', '10:09:00']);

      const withCopiedToken = await signIn(MIREILLE, 'Akwa-Tresses-27', { tokens: ['tablet'] });

      expect(refusalOf(withCopiedToken)).toMatchObject({ code: 'SIGN_IN_TEMPORARILY_BLOCKED' });
    });

    it('never stores a token chosen by the client as a device token: a forged one is ignored and a fresh one is issued', async () => {
      const result = await signIn(PAUL, GOOD, { tokens: ['forged'] });

      expect(result).toEqual({ status: 'SIGNED_IN', userId: PAUL_ID, credentialsVersion: 1, deviceTokens: ['forged', 'tok-1'] });
      expect(devices.all().map((d) => d.tokenHash)).toEqual(['h:tok-1']);
    });

    it('keeps at most 5 tokens in the cookie, the oldest leaving first', async () => {
      const result = await signIn(PAUL, GOOD, { tokens: ['a', 'b', 'c', 'd', 'e'] });

      expect(result).toEqual({
        status: 'SIGNED_IN',
        userId: PAUL_ID,
        credentialsVersion: 1,
        deviceTokens: ['b', 'c', 'd', 'e', 'tok-1'],
      });
    });

    it('stores only a fingerprint of the device token', async () => {
      await signIn(PAUL, GOOD);

      expect(Object.values(devices.all()[0] ?? {})).not.toContain('tok-1');
      expect(devices.all()[0]?.tokenHash).toBe('h:tok-1');
    });

    it('recognises a phone from the token issued at its previous sign-in', async () => {
      const first = await signIn(PAUL, GOOD);
      await priorFailures(PAUL, FIVE_WRONG);
      clock.set(at('10:00:30'));
      const second = await signIn(PAUL, GOOD, {
        tokens: first.status === 'SIGNED_IN' ? first.deviceTokens : [],
      });

      expect(second).toEqual({ status: 'SIGNED_IN', userId: PAUL_ID, credentialsVersion: 1, deviceTokens: ['tok-2'] });
    });

    it('never recognises a device for a number that has no account', async () => {
      await rememberDevice(PAUL_ID, 'usual', at('10:00:00', '10'));
      await priorFailures(NOBODY, FIVE_WRONG);

      const result = await signIn(NOBODY, GOOD, { tokens: ['usual'] });

      expect(refusalOf(result)).toMatchObject({ code: 'SIGN_IN_TEMPORARILY_BLOCKED' });
    });

    it('looks the device up the same way with or without an account, so that the response time does not reveal accounts', async () => {
      await priorFailures(NOBODY, FIVE_WRONG);
      await priorFailures(PAUL, FIVE_WRONG);

      await signIn(NOBODY, GOOD, { tokens: ['forged'] });
      const withoutAccount = { hashes: hashCalls, lookups: devices.lookups };
      hashCalls = 0;
      devices.lookups = 0;
      await signIn(PAUL, GOOD, { tokens: ['forged'] });
      const withAccount = { hashes: hashCalls, lookups: devices.lookups };

      expect(withAccount).toEqual(withoutAccount);
      expect(withAccount).toEqual({ hashes: 5, lookups: 1 });
    });
  });
});
