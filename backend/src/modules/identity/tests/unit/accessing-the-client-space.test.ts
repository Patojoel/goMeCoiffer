import { beforeEach, describe, expect, it } from 'vitest';
import { RefuseAfterCommit } from '../../../../shared/application/refuse-after-commit.js';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { RequestClientCode } from '../../application/commands/request-client-code/request-client-code.command.js';
import { RequestClientCodeHandler } from '../../application/commands/request-client-code/request-client-code.handler.js';
import { VerifyClientCode } from '../../application/commands/verify-client-code/verify-client-code.command.js';
import { VerifyClientCodeHandler } from '../../application/commands/verify-client-code/verify-client-code.handler.js';
import { OtpChallenge } from '../../domain/aggregates/otp-challenge.js';
import { User } from '../../domain/aggregates/user.js';
import { OtpPurpose } from '../../domain/enums/otp-purpose.enum.js';
import {
  FixedOtpCodes,
  fakeSecretHasher,
  InMemoryAuditTrail,
  InMemoryOtpChallengeRepository,
  InMemoryOtpSendHistory,
  InMemorySmsSender,
  InMemoryUserRepository,
} from '../fakes/identity-fakes.js';

const at = (time: string, date = '2026-11-20') => new Date(`${date}T${time}+01:00`);
const NADEGE = '6 94 12 34 56';
const NADEGE_E164 = '+237694123456';
const AICHA = '6 55 44 33 22';
const AICHA_E164 = '+237655443322';
const AICHA_ID = '0195f000-0000-7000-8000-00000000a003';
const PAUL = '6 99 00 11 22';
const PAUL_E164 = '+237699001122';
const PAUL_ID = '0195f000-0000-7000-8000-00000000a001';
const JEANNE = '6 75 31 42 00';
const JEANNE_ID = '0195f000-0000-7000-8000-00000000a004';

describe('Accessing the client space with a code received by SMS', () => {
  let clock: FixedClock;
  let users: InMemoryUserRepository;
  let challenges: InMemoryOtpChallengeRepository;
  let sms: InMemorySmsSender;
  let audit: InMemoryAuditTrail;
  let requestCode: RequestClientCodeHandler;
  let verifyCode: VerifyClientCodeHandler;

  const setUp = (codes: string[]) => {
    clock = new FixedClock(at('10:00:00'));
    users = new InMemoryUserRepository();
    users.seedLightClient(AICHA_ID, PhoneNumber.parse(AICHA));
    users.seedStaff(PAUL_ID, PhoneNumber.parse(PAUL), 'argon:Bastos-Fade-2026');
    challenges = new InMemoryOtpChallengeRepository();
    sms = new InMemorySmsSender();
    audit = new InMemoryAuditTrail();
    const ids = new SequentialIdGenerator();
    requestCode = new RequestClientCodeHandler(
      challenges,
      new InMemoryOtpSendHistory(challenges),
      new FixedOtpCodes(codes),
      fakeSecretHasher,
      sms,
      clock,
      ids,
    );
    verifyCode = new VerifyClientCodeHandler(users, challenges, fakeSecretHasher, audit, clock, ids);
  };

  const askCode = (phone = NADEGE, termsAccepted = true) =>
    requestCode.execute(new RequestClientCode({ phone, termsAccepted }));
  const enterCode = (code: string, phone = NADEGE) =>
    verifyCode.execute(new VerifyClientCode({ phone, code }));
  const advance = (seconds: number) => clock.advanceMinutes(seconds / 60);

  beforeEach(() =>
    setUp([
      '482913',
      '105377',
      '000111',
      '000222',
      '000333',
      '000444',
      '000555',
      '000666',
      '000777',
      '000888',
      '000999',
    ]),
  );

  describe('requesting a client access code', () => {
    it.each([['6 94 12 34 5'], ['+33 6 12 34 56 78']])(
      'refuses a number that is not Cameroonian (%s), creating no challenge and sending no SMS',
      async (malformed) => {
        await expect(askCode(malformed)).rejects.toBeInstanceOf(InvalidValueError);

        expect(challenges.all()).toEqual([]);
        expect(sms.sent).toEqual([]);
      },
    );

    it('refuses when the terms of use are not accepted, creating no challenge and sending no SMS', async () => {
      await expect(askCode(NADEGE, false)).rejects.toMatchObject({
        code: 'TERMS_NOT_ACCEPTED',
        message: "Acceptez les conditions d'utilisation pour continuer.",
      });

      expect(challenges.all()).toEqual([]);
      expect(sms.sent).toEqual([]);
    });

    it('refuses a new code requested less than 60 seconds after the previous one, to the second', async () => {
      await askCode(NADEGE);
      advance(59);

      await expect(askCode(NADEGE)).rejects.toMatchObject({
        code: 'OTP_RESEND_TOO_SOON',
      });

      advance(1);
      await expect(askCode(NADEGE)).resolves.toBeDefined();
    });

    it('refuses a 6th client code within the same hour', async () => {
      for (let i = 0; i < 5; i++) {
        await askCode(NADEGE);
        advance(10 * 60);
      }

      await expect(askCode(NADEGE)).rejects.toMatchObject({
        code: 'OTP_TOO_MANY_REQUESTS',
      });
    });

    it('refuses an 11th client code within 24 hours', async () => {
      clock.set(at('11:00:00', '2026-11-19'));
      for (let i = 0; i < 10; i++) {
        await askCode(NADEGE);
        advance(2 * 3600);
      }
      clock.set(at('10:00:00', '2026-11-20'));

      await expect(askCode(NADEGE)).rejects.toMatchObject({
        code: 'OTP_TOO_MANY_REQUESTS',
      });
    });

    it('stops sending client codes after 10 wrong codes on this number within 24 hours', async () => {
      for (let round = 0; round < 2; round++) {
        await askCode(NADEGE);
        for (const wrong of ['000001', '000002', '000003', '000004', '000005'])
          await expect(enterCode(wrong)).rejects.toBeInstanceOf(RefuseAfterCommit);
        advance(60);
      }

      await expect(askCode(NADEGE)).rejects.toMatchObject({
        code: 'OTP_TOO_MANY_REQUESTS',
      });
    });

    it('does not let sign-up codes use up the client access quota', async () => {
      const phone = PhoneNumber.parse(NADEGE);
      for (let i = 0; i < 5; i++) {
        const signUp = OtpChallenge.issue({
          id: `signup-${i}`,
          phone,
          purpose: OtpPurpose.SIGN_UP,
          codeHash: 'x',
          now: new Date(at('09:10:00').getTime() + i * 60_000),
        });
        signUp.supersede();
        await challenges.save(signUp);
      }

      await expect(askCode(NADEGE)).resolves.toBeDefined();
      expect(sms.sent).toHaveLength(1);
    });

    it('announces an SMS provider outage, leaves no active challenge and does not count the request', async () => {
      sms.outage = true;

      await expect(askCode(NADEGE)).rejects.toMatchObject({
        code: 'SMS_UNAVAILABLE',
        message: "L'envoi du SMS est impossible pour le moment. Réessayez dans quelques minutes.",
      });
      expect(challenges.all()).toEqual([]);

      sms.outage = false;
      advance(30);
      await expect(askCode(NADEGE)).resolves.toBeDefined();
    });

    it('sends a real code with the fixed client message and returns the exact same response shape for no account, a light client and a staff member', async () => {
      const forNadege = await askCode(NADEGE);
      const forAicha = await askCode(AICHA);
      const forPaul = await askCode(PAUL);

      expect(forNadege).toEqual({
        maskedPhone: '6 94 •• •• 56',
        expiresInSeconds: 300,
        resendInSeconds: 60,
      });
      expect({ ...forAicha, maskedPhone: '' }).toEqual({ ...forNadege, maskedPhone: '' });
      expect({ ...forPaul, maskedPhone: '' }).toEqual({ ...forNadege, maskedPhone: '' });
      expect(sms.lastTo(NADEGE_E164)).toBe(
        'GoMeCoiffer : votre code pour retrouver vos réservations est 482913. Il expire dans 5 minutes. Ne le communiquez à personne.',
      );
      expect(sms.lastTo(AICHA_E164)).toBe(
        'GoMeCoiffer : votre code pour retrouver vos réservations est 105377. Il expire dans 5 minutes. Ne le communiquez à personne.',
      );
      expect(sms.lastTo(PAUL_E164)).toBe(
        'GoMeCoiffer : votre code pour retrouver vos réservations est 000111. Il expire dans 5 minutes. Ne le communiquez à personne.',
      );
    });
  });

  describe('verifying the client access code', () => {
    it('refuses when no client code was requested for this number', async () => {
      await expect(enterCode('482913')).rejects.toMatchObject({
        code: 'OTP_NO_LONGER_VALID',
      });
    });

    it('refuses a code issued for another purpose and counts the wrong attempt on the active client challenge', async () => {
      await challenges.save(
        OtpChallenge.issue({
          id: 'signup-1',
          phone: PhoneNumber.parse(NADEGE),
          purpose: OtpPurpose.SIGN_UP,
          codeHash: fakeSecretHasher.hash('105377'),
          now: at('09:58:00'),
        }),
      );
      await askCode(NADEGE);

      await expect(enterCode('105377')).rejects.toMatchObject({
        refusal: {
          code: 'OTP_INCORRECT',
          message: 'Code incorrect. Il vous reste 4 essais.',
        },
      });
    });

    it('refuses a wrong code, commits the counted attempt and creates no account', async () => {
      await askCode(NADEGE);

      await expect(enterCode('000000')).rejects.toBeInstanceOf(RefuseAfterCommit);
      await expect(enterCode('000001')).rejects.toMatchObject({
        refusal: {
          code: 'OTP_INCORRECT',
          message: 'Code incorrect. Il vous reste 3 essais.',
        },
      });
      expect(await users.findByPhone(PhoneNumber.parse(NADEGE))).toBeNull();
    });

    it.each([
      ['10:04:59', true],
      ['10:05:00', false],
    ])('accepts a code sent at 10:00:00 until 10:04:59 and refuses it at 10:05:00 (checked at %s)', async (time, accepted) => {
      await askCode(NADEGE);
      clock.set(at(time));

      if (accepted) {
        await expect(enterCode('482913')).resolves.toMatchObject({ maskedPhone: '6 94 •• •• 56' });
      } else {
        await expect(enterCode('482913')).rejects.toMatchObject({
          refusal: { code: 'OTP_EXPIRED', message: 'Ce code a expiré. Demandez-en un nouveau.' },
        });
      }
    });

    it('refuses even the right code after 5 wrong attempts', async () => {
      await askCode(NADEGE);
      for (const wrong of ['000001', '000002', '000003', '000004', '000005'])
        await expect(enterCode(wrong)).rejects.toBeInstanceOf(RefuseAfterCommit);

      await expect(enterCode('482913')).rejects.toMatchObject({
        refusal: { code: 'OTP_ATTEMPTS_EXHAUSTED', message: "Trop d'essais. Demandez un nouveau code." },
      });
      expect(await users.findByPhone(PhoneNumber.parse(NADEGE))).toBeNull();
    });

    it('cancels the previous code when a new one is requested', async () => {
      await askCode(NADEGE);
      advance(60);
      await askCode(NADEGE);

      await expect(enterCode('482913')).rejects.toMatchObject({
        refusal: { code: 'OTP_INCORRECT', message: 'Code incorrect. Il vous reste 4 essais.' },
      });
      await expect(enterCode('105377')).resolves.toMatchObject({ maskedPhone: '6 94 •• •• 56' });
    });

    it('creates a light client account without name, email or password for a number without account, and traces creation and sign-in', async () => {
      await askCode(NADEGE);

      const verified = await enterCode('482913');

      const created = (await users.findByPhone(PhoneNumber.parse(NADEGE)))?.snapshot();
      expect(created).toEqual({
        id: verified.userId,
        phone: NADEGE_E164,
        name: null,
        email: null,
        passwordHash: null,
        phoneVerifiedAt: at('10:00:00'),
        holderSince: at('10:00:00'),
        termsAcceptedAt: at('10:00:00'),
        createdAt: at('10:00:00'),
        credentialsVersion: 1,
        version: 1,
      });
      expect(audit.entries).toEqual([
        {
          action: 'CLIENT_ACCOUNT_CREATED',
          subjectType: 'user',
          subjectId: verified.userId,
          actorUserId: verified.userId,
          occurredAt: at('10:00:00'),
        },
        {
          action: 'CLIENT_SIGNED_IN',
          subjectType: 'user',
          subjectId: verified.userId,
          actorUserId: verified.userId,
          occurredAt: at('10:00:00'),
        },
      ]);
      expect(JSON.stringify(audit.entries)).not.toMatch(/6 ?94|482913/);
    });

    it('finds an existing light client account without duplicating it and traces only the client sign-in', async () => {
      await askCode(AICHA);

      const verified = await enterCode('482913', AICHA);

      expect(verified).toEqual({
        userId: AICHA_ID,
        credentialsVersion: 1,
        maskedPhone: '6 55 •• •• 22',
      });
      expect(users.all().filter((u) => u.phone === AICHA_E164)).toHaveLength(1);
      expect(audit.entries).toEqual([
        {
          action: 'CLIENT_SIGNED_IN',
          subjectType: 'user',
          subjectId: AICHA_ID,
          actorUserId: AICHA_ID,
          occurredAt: at('10:00:00'),
        },
      ]);
    });

    it('finds an existing staff account and leaves its password hash, name, email and credentialsVersion untouched', async () => {
      await askCode(PAUL);

      const verified = await enterCode('482913', PAUL);

      expect(verified).toEqual({
        userId: PAUL_ID,
        credentialsVersion: 1,
        maskedPhone: '6 99 •• •• 22',
      });
      const paul = (await users.findByPhone(PhoneNumber.parse(PAUL)))?.snapshot();
      expect(paul).toMatchObject({
        id: PAUL_ID,
        name: 'Paul Ebode',
        email: null,
        passwordHash: 'argon:Bastos-Fade-2026',
        credentialsVersion: 1,
        phoneVerifiedAt: at('10:00:00'),
      });
      expect(audit.entries).toEqual([
        {
          action: 'CLIENT_SIGNED_IN',
          subjectType: 'user',
          subjectId: PAUL_ID,
          actorUserId: PAUL_ID,
          occurredAt: at('10:00:00'),
        },
      ]);
    });

    it('returns the exact same response shape for a newly created client, an existing light client and a staff member', async () => {
      await askCode(NADEGE);
      await askCode(AICHA);
      await askCode(PAUL);

      const nadegeRes = await enterCode('482913', NADEGE);
      const aichaRes = await enterCode('105377', AICHA);
      const paulRes = await enterCode('000111', PAUL);

      expect(Object.keys(nadegeRes).sort()).toEqual(['credentialsVersion', 'maskedPhone', 'userId']);
      expect(Object.keys(aichaRes).sort()).toEqual(Object.keys(nadegeRes).sort());
      expect(Object.keys(paulRes).sort()).toEqual(Object.keys(nadegeRes).sort());
    });
  });

  describe('presumed new holder of a recycled phone number (RG-009-06)', () => {
    const accountWithLastProof = (phoneVerifiedAt: Date | null, holderSince: Date | null) =>
      User.restore({
        id: JEANNE_ID,
        phone: PhoneNumber.parse(JEANNE).value,
        name: null,
        email: null,
        passwordHash: null,
        phoneVerifiedAt,
        holderSince,
        termsAcceptedAt: new Date('2026-04-01T10:00:00+01:00'),
        createdAt: new Date('2026-04-01T10:00:00+01:00'),
        credentialsVersion: 1,
        version: 1,
      });

    it('keeps holderSince unchanged when the last phone proof was exactly 180 days ago', () => {
      const initialHolderSince = new Date('2026-04-01T10:00:00+01:00');
      const exactly180DaysAgo = new Date('2026-05-24T10:00:00+01:00');
      const jeanne = accountWithLastProof(exactly180DaysAgo, initialHolderSince);

      jeanne.recordPhoneProof(at('10:00:00', '2026-11-20'));

      expect(jeanne.holderSince).toEqual(initialHolderSince);
      expect(jeanne.snapshot().phoneVerifiedAt).toEqual(at('10:00:00', '2026-11-20'));
    });

    it('resets holderSince to now when the last phone proof was 180 days and 1 second ago', () => {
      const initialHolderSince = new Date('2026-04-01T10:00:00+01:00');
      const over180DaysAgo = new Date('2026-05-24T09:59:59+01:00');
      const jeanne = accountWithLastProof(over180DaysAgo, initialHolderSince);
      const now = at('10:00:00', '2026-11-20');

      jeanne.recordPhoneProof(now);

      expect(jeanne.holderSince).toEqual(now);
      expect(jeanne.snapshot().phoneVerifiedAt).toEqual(now);
    });

    it('sets holderSince to now when the account had no previous phone proof date', () => {
      const legacy = accountWithLastProof(null, null);
      const now = at('10:00:00', '2026-11-20');

      legacy.recordPhoneProof(now);

      expect(legacy.holderSince).toEqual(now);
      expect(legacy.snapshot().phoneVerifiedAt).toEqual(now);
    });
  });

  it('never leaks the phone number or the code when the commands are serialised', () => {
    expect(JSON.stringify(new RequestClientCode({ phone: NADEGE, termsAccepted: true }))).not.toContain(
      '694',
    );
    expect(JSON.stringify(new VerifyClientCode({ phone: NADEGE, code: '482913' }))).not.toMatch(
      /694|482913/,
    );
  });
});
