import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { OtpChallenge } from '../../domain/otp-challenge.js';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { ConfirmSignUp } from '../../application/commands/confirm-sign-up/confirm-sign-up.command.js';
import { ConfirmSignUpHandler } from '../../application/commands/confirm-sign-up/confirm-sign-up.handler.js';
import { RequestSignUpCode } from '../../application/commands/request-sign-up-code/request-sign-up-code.command.js';
import { RequestSignUpCodeHandler } from '../../application/commands/request-sign-up-code/request-sign-up-code.handler.js';
import {
  commonPasswords,
  FixedOtpCodes,
  fakePasswordHasher,
  fakeSecretHasher,
  InMemoryAuditTrail,
  InMemoryOtpChallengeRepository,
  InMemorySmsSender,
  InMemoryUserRepository,
} from '../fakes/identity-fakes.js';

const MIREILLE = '6 77 12 34 56';
const MIREILLE_E164 = '+237677123456';
const PAUL = '6 99 00 11 22';
const owner = (code: string, password = 'Akwa-Tresses-27') =>
  new ConfirmSignUp({
    phone: MIREILLE,
    code,
    name: 'Mireille Ndongo',
    email: 'mireille@gobeauty.cm',
    password,
  });

describe('Signing up as a salon owner', () => {
  let clock: FixedClock;
  let users: InMemoryUserRepository;
  let challenges: InMemoryOtpChallengeRepository;
  let sms: InMemorySmsSender;
  let audit: InMemoryAuditTrail;
  let requestCode: RequestSignUpCodeHandler;
  let confirm: ConfirmSignUpHandler;

  const setUp = (codes: string[]) => {
    clock = new FixedClock(new Date('2026-11-18T10:00:00+01:00'));
    users = new InMemoryUserRepository();
    challenges = new InMemoryOtpChallengeRepository();
    sms = new InMemorySmsSender();
    audit = new InMemoryAuditTrail();
    const ids = new SequentialIdGenerator();
    requestCode = new RequestSignUpCodeHandler(
      users,
      challenges,
      new FixedOtpCodes(codes),
      fakeSecretHasher,
      sms,
      clock,
      ids,
    );
    confirm = new ConfirmSignUpHandler(
      users,
      challenges,
      fakeSecretHasher,
      fakePasswordHasher,
      commonPasswords,
      audit,
      clock,
      ids,
    );
  };
  const advance = (seconds: number) => clock.advanceMinutes(seconds / 60);

  beforeEach(() => setUp(['482913', '105377', '000111', '000222', '000333', '000444']));

  describe('requesting a code', () => {
    it('refuses a number that is not a Cameroonian mobile or landline, without sending any SMS', async () => {
      await expect(requestCode.execute(new RequestSignUpCode('6 77 12 34 5'))).rejects.toBeInstanceOf(
        InvalidValueError,
      );
      expect(sms.sent).toEqual([]);
    });

    it('refuses a new code requested less than 60 seconds after the previous one', async () => {
      await requestCode.execute(new RequestSignUpCode(MIREILLE));
      advance(59);

      await expect(requestCode.execute(new RequestSignUpCode(MIREILLE))).rejects.toMatchObject({
        code: 'OTP_RESEND_TOO_SOON',
      });
    });

    it('refuses a 6th code within the same hour', async () => {
      for (let i = 0; i < 5; i++) {
        await requestCode.execute(new RequestSignUpCode(MIREILLE));
        advance(10 * 60);
      }

      await expect(requestCode.execute(new RequestSignUpCode(MIREILLE))).rejects.toMatchObject({
        code: 'OTP_TOO_MANY_REQUESTS',
      });
    });

    it('does not count a request the SMS provider could not deliver', async () => {
      sms.outage = true;
      await expect(requestCode.execute(new RequestSignUpCode(MIREILLE))).rejects.toMatchObject({
        code: 'SMS_UNAVAILABLE',
      });
      sms.outage = false;
      advance(30);

      await expect(requestCode.execute(new RequestSignUpCode(MIREILLE))).resolves.toBeDefined();
    });

    it('stops sending sign-up codes after 10 wrong codes on this number within 24 hours', async () => {
      for (let round = 0; round < 2; round++) {
        await requestCode.execute(new RequestSignUpCode(MIREILLE));
        for (const wrong of ['000001', '000002', '000003', '000004', '000005'])
          await confirm.execute(owner(wrong));
        advance(60);
      }

      await expect(requestCode.execute(new RequestSignUpCode(MIREILLE))).rejects.toMatchObject({
        code: 'OTP_TOO_MANY_REQUESTS',
      });
    });

    it('does not let codes sent for another purpose use up the sign-up quota', async () => {
      const phone = PhoneNumber.parse(MIREILLE);
      for (let i = 0; i < 5; i++) {
        const reset = OtpChallenge.issue({
          id: `reset-${i}`,
          phone,
          purpose: 'PASSWORD_RESET',
          codeHash: 'x',
          now: clock.now(),
        });
        reset.supersede();
        await challenges.save(reset);
      }

      await expect(requestCode.execute(new RequestSignUpCode(MIREILLE))).resolves.toBeDefined();
    });

    it('sends the code by SMS and tells how long it is valid', async () => {
      const sent = await requestCode.execute(new RequestSignUpCode(MIREILLE));

      expect(sent).toEqual({ maskedPhone: '6 77 •• •• 56', expiresInSeconds: 300, resendInSeconds: 60 });
      expect(sms.lastTo(MIREILLE_E164)).toBe(
        'GoMeCoiffer : votre code est 482913. Il expire dans 5 minutes. Ne le communiquez à personne.',
      );
    });

    it('answers exactly the same for an already registered number, whose owner gets an SMS without code', async () => {
      users.seedStaff('0195f000-0000-7000-8000-00000000a001', PhoneNumber.parse(PAUL));
      const forNewNumber = await requestCode.execute(new RequestSignUpCode(MIREILLE));

      const forRegistered = await requestCode.execute(new RequestSignUpCode(PAUL));

      expect({ ...forRegistered, maskedPhone: '' }).toEqual({ ...forNewNumber, maskedPhone: '' });
      expect(sms.lastTo('+237699001122')).toBe(
        'GoMeCoiffer : un compte existe déjà pour ce numéro. Connectez-vous ou utilisez « Mot de passe oublié ».',
      );
    });
  });

  describe('confirming with the code', () => {
    beforeEach(() => requestCode.execute(new RequestSignUpCode(MIREILLE)));

    it('refuses when no code was requested for this number', async () => {
      const result = await confirm.execute(
        new ConfirmSignUp({
          phone: PAUL,
          code: '482913',
          name: 'Paul Ebode',
          email: null,
          password: 'Akwa-Tresses-27',
        }),
      );
      expect(result).toMatchObject({ status: 'REFUSED', refusal: { code: 'OTP_NO_LONGER_VALID' } });
    });

    it('refuses a wrong code, keeps counting the attempts and creates no account', async () => {
      await confirm.execute(owner('000000'));

      const second = await confirm.execute(owner('000001'));

      expect(second).toMatchObject({
        status: 'REFUSED',
        refusal: { message: 'Code incorrect. Il vous reste 3 essais.' },
      });
      expect(users.all()).toEqual([]);
    });

    it('refuses a code used after its 5 minutes', async () => {
      advance(5 * 60 + 1);
      expect(await confirm.execute(owner('482913'))).toMatchObject({
        status: 'REFUSED',
        refusal: { code: 'OTP_EXPIRED' },
      });
    });

    it('refuses even the right code after 5 wrong attempts', async () => {
      for (const wrong of ['000001', '000002', '000003', '000004', '000005'])
        await confirm.execute(owner(wrong));

      expect(await confirm.execute(owner('482913'))).toMatchObject({
        status: 'REFUSED',
        refusal: { code: 'OTP_ATTEMPTS_EXHAUSTED' },
      });
    });

    it('no longer accepts a code replaced by a newer one', async () => {
      advance(60);
      await requestCode.execute(new RequestSignUpCode(MIREILLE));

      expect(await confirm.execute(owner('482913'))).toMatchObject({
        status: 'REFUSED',
        refusal: { message: 'Code incorrect. Il vous reste 4 essais.' },
      });
      expect(await confirm.execute(owner('105377'))).toMatchObject({ status: 'SIGNED_UP' });
    });

    it('keeps the code usable when the password is refused, so no new SMS is needed', async () => {
      await expect(confirm.execute(owner('482913', 'salon2026'))).rejects.toMatchObject({
        code: 'PASSWORD_TOO_SHORT',
      });

      expect(await confirm.execute(owner('482913'))).toMatchObject({
        status: 'SIGNED_UP',
        outcome: 'CREATED',
      });
    });

    it('creates the owner account with a verified number, a hashed password and no role', async () => {
      const result = await confirm.execute(owner('482913'));

      expect(result).toMatchObject({ status: 'SIGNED_UP', outcome: 'CREATED' });
      expect(users.all()).toEqual([
        expect.objectContaining({
          phone: MIREILLE_E164,
          name: 'Mireille Ndongo',
          email: 'mireille@gobeauty.cm',
          passwordHash: 'argon:Akwa-Tresses-27',
          phoneVerifiedAt: new Date('2026-11-18T10:00:00+01:00'),
          termsAcceptedAt: new Date('2026-11-18T10:00:00+01:00'),
        }),
      ]);
    });

    it('traces the account creation without the code nor the password', async () => {
      await confirm.execute(owner('482913'));

      expect(audit.entries).toEqual([
        expect.objectContaining({
          action: 'OWNER_ACCOUNT_CREATED',
          subjectType: 'user',
          occurredAt: clock.now(),
        }),
      ]);
      expect(JSON.stringify(audit.entries)).not.toMatch(/482913|Akwa-Tresses-27/);
    });

    it('completes the light client account of the same number instead of creating a second one', async () => {
      setUp(['482913']);
      users.seedLightClient('0195f000-0000-7000-8000-00000000c0de', PhoneNumber.parse(MIREILLE));
      await requestCode.execute(new RequestSignUpCode(MIREILLE));

      const result = await confirm.execute(owner('482913'));

      expect(result).toMatchObject({
        status: 'SIGNED_UP',
        outcome: 'COMPLETED',
        userId: '0195f000-0000-7000-8000-00000000c0de',
      });
      expect(users.all()).toHaveLength(1);
      expect(audit.entries[0]?.action).toBe('CLIENT_ACCOUNT_COMPLETED_AS_OWNER');
    });
  });

  it('never reveals the password nor the code if the command is logged or serialised', () => {
    expect(JSON.stringify(owner('482913'))).not.toMatch(/482913|Akwa-Tresses-27/);
  });

  it('never signs up again a number that already has a password, even with a valid code', async () => {
    setUp(['482913']);
    users.seedStaff('0195f000-0000-7000-8000-00000000a001', PhoneNumber.parse(MIREILLE));
    await requestCode.execute(new RequestSignUpCode(MIREILLE));

    await expect(confirm.execute(owner('482913'))).rejects.toMatchObject({
      code: 'ACCOUNT_ALREADY_REGISTERED',
    });
  });
});
