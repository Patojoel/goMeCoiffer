import { ConsoleLogger, Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { RequestPasswordResetCode } from '../../application/commands/request-password-reset-code/request-password-reset-code.command.js';
import { RequestPasswordResetCodeHandler } from '../../application/commands/request-password-reset-code/request-password-reset-code.handler.js';
import { OtpChallenge } from '../../domain/aggregates/otp-challenge.js';
import {
  FakeAfterCommit,
  FixedOtpCodes,
  fakeSecretHasher,
  InMemoryOtpChallengeRepository,
  InMemoryOtpSendHistory,
  InMemorySmsSender,
  InMemoryUserRepository,
} from '../fakes/identity-fakes.js';

const at = (time: string) => new Date(`2026-11-19T${time}+01:00`);
const PAUL = '6 99 00 11 22';
const PAUL_E164 = '+237699001122';
const AICHA = '6 55 44 33 22';
const NOBODY = '6 70 00 00 01';

describe('Requesting a password reset code', () => {
  let clock: FixedClock;
  let users: InMemoryUserRepository;
  let challenges: InMemoryOtpChallengeRepository;
  let sms: InMemorySmsSender;
  let afterCommit: FakeAfterCommit;
  let handler: RequestPasswordResetCodeHandler;

  beforeEach(() => {
    clock = new FixedClock(at('10:00:00'));
    users = new InMemoryUserRepository();
    users.seedStaff('0195f000-0000-7000-8000-00000000a001', PhoneNumber.parse(PAUL));
    users.seedLightClient('0195f000-0000-7000-8000-00000000a003', PhoneNumber.parse(AICHA));
    challenges = new InMemoryOtpChallengeRepository();
    sms = new InMemorySmsSender();
    afterCommit = new FakeAfterCommit();
    handler = new RequestPasswordResetCodeHandler(
      users,
      challenges,
      new InMemoryOtpSendHistory(challenges),
      new FixedOtpCodes(['482913', '105377', '222222', '333333', '444444', '555555', '666666']),
      fakeSecretHasher,
      sms,
      afterCommit.asAfterCommit(),
      clock,
      new SequentialIdGenerator(),
    );
  });

  const request = async (phone: string) => {
    const response = await handler.execute(new RequestPasswordResetCode(phone));
    await afterCommit.commit();
    return response;
  };
  const advance = (seconds: number) => clock.advanceMinutes(seconds / 60);

  it('refuses a number that is not Cameroonian, without sending anything', async () => {
    await expect(request('6 99 00 11 2')).rejects.toBeInstanceOf(InvalidValueError);

    expect(sms.sent).toEqual([]);
    expect(challenges.all()).toEqual([]);
  });

  it('texts the code to a staff account', async () => {
    await request(PAUL);

    expect(sms.lastTo(PAUL_E164)).toBe(
      'GoMeCoiffer : votre code pour changer de mot de passe est 482913. Il expire dans 5 minutes. Ne le communiquez à personne.',
    );
    expect(challenges.all()).toHaveLength(1);
  });

  it('sends the SMS only after the response, never during the request', async () => {
    await handler.execute(new RequestPasswordResetCode(PAUL));

    expect(sms.sent).toEqual([]);
    await afterCommit.commit();
    expect(sms.sent).toHaveLength(1);
  });

  it.each([
    ['a light client account', AICHA],
    ['a number with no account', NOBODY],
  ])('sends nothing to %s but records the request like a sent code', async (_label, phone) => {
    await request(phone);

    expect(sms.sent).toEqual([]);
    expect(challenges.all()).toHaveLength(1);
  });

  it('answers the same way whether the number has a staff account, a light account or none', async () => {
    const forPaul = await request(PAUL);
    const forAicha = await request(AICHA);
    const forNobody = await request(NOBODY);

    expect(forPaul).toEqual({ maskedPhone: '6 99 •• •• 22', expiresInSeconds: 300, resendInSeconds: 60 });
    expect(forAicha).toEqual({ maskedPhone: '6 55 •• •• 22', expiresInSeconds: 300, resendInSeconds: 60 });
    expect(forNobody).toEqual({ maskedPhone: '6 70 •• •• 01', expiresInSeconds: 300, resendInSeconds: 60 });
  });

  it('never keeps the code in clear in the stored challenge of a number without account', async () => {
    await request(NOBODY);

    expect(JSON.stringify(challenges.all())).not.toMatch(/\b\d{6}\b/);
  });

  it('refuses a new code requested less than 60 seconds after the previous one, to the second', async () => {
    await request(PAUL);
    advance(59);
    await expect(request(PAUL)).rejects.toMatchObject({ code: 'OTP_RESEND_TOO_SOON' });

    advance(1);
    await expect(request(PAUL)).resolves.toBeDefined();
  });

  it('limits a number without account like any other', async () => {
    for (let i = 0; i < 5; i++) {
      await request(NOBODY);
      advance(10 * 60);
    }

    await expect(request(NOBODY)).rejects.toMatchObject({ code: 'OTP_TOO_MANY_REQUESTS' });
  });

  it('does not let sign-up codes use up the password reset quota', async () => {
    const phone = PhoneNumber.parse(PAUL);
    for (let i = 0; i < 5; i++) {
      const signUp = OtpChallenge.issue({
        id: `sign-up-${i}`,
        phone,
        purpose: 'SIGN_UP',
        codeHash: 'x',
        now: new Date(at('09:10:00').getTime() + i * 60_000),
      });
      signUp.supersede();
      await challenges.save(signUp);
    }

    await expect(request(PAUL)).resolves.toBeDefined();
    expect(sms.sent).toHaveLength(1);
  });

  it('cancels the previous code when a new one is requested', async () => {
    await request(PAUL);
    advance(60);
    await request(PAUL);

    const [first, second] = challenges.all();
    expect(first!.status).toBe('SUPERSEDED');
    expect(second!.status).toBe('ACTIVE');
  });

  it('shows nothing of an SMS outage: a second request within 60 seconds is refused as for a number without account', async () => {
    sms.outage = true;
    await request(PAUL);
    await request(NOBODY);
    advance(30);

    const forPaul = await request(PAUL).catch((error: Error) => error);
    const forNobody = await request(NOBODY).catch((error: Error) => error);

    expect(forPaul).toMatchObject({ code: 'OTP_RESEND_TOO_SOON', message: expect.stringContaining('30 secondes') });
    expect(forPaul).toEqual(forNobody);
    expect(challenges.all().filter((c) => c.phone === PAUL_E164)).toHaveLength(1);
  });

  it('counts a request whose SMS failed, like any other', async () => {
    sms.outage = true;
    for (let i = 0; i < 5; i++) {
      await request(PAUL);
      advance(10 * 60);
    }

    await expect(request(PAUL)).rejects.toMatchObject({ code: 'OTP_TOO_MANY_REQUESTS' });
  });

  it('logs an SMS failure without the number or the text of the SMS, even if the error message holds them', async () => {
    const logged: string[] = [];
    const capture = (...args: unknown[]) => logged.push(JSON.stringify(args));
    Logger.overrideLogger({ log: capture, warn: capture, error: capture, debug: capture, verbose: capture });
    sms.failure = Object.assign(new Error('refused for +237699001122 : GoMeCoiffer ... est 482913.'), {
      code: 'PROVIDER_REJECTED',
      stack: "Error: refused for +237699001122 : 482913 at provider",
    });

    try {
      await request(PAUL);
    } finally {
      Logger.overrideLogger(new ConsoleLogger());
    }

    expect(logged.length).toBeGreaterThan(0);
    expect(logged.join('')).toContain('PROVIDER_REJECTED');
    for (const secret of ['699001122', '482913', 'refused', 'provider']) expect(logged.join('')).not.toContain(secret);
  });
});
