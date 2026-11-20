import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidValueError } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { RequestInvitationCode } from '../../application/commands/request-invitation-code/request-invitation-code.command.js';
import { RequestInvitationCodeHandler } from '../../application/commands/request-invitation-code/request-invitation-code.handler.js';
import { OtpChallenge } from '../../domain/aggregates/otp-challenge.js';
import {
  FakeAfterCommit,
  FixedOtpCodes,
  fakeSecretHasher,
  InMemoryOtpChallengeRepository,
  InMemoryOtpSendHistory,
  InMemoryPendingInvitations,
  InMemorySmsSender,
} from '../fakes/identity-fakes.js';

const at = (time: string) => new Date(`2026-11-20T${time}+01:00`);
const BRICE = '6 55 44 33 22';
const BRICE_E164 = '+237655443322';
const NOBODY = '6 70 00 00 01';
const EXPIRED_ONLY = '6 70 11 22 33';

describe('Requesting a code to join a salon', () => {
  let clock: FixedClock;
  let challenges: InMemoryOtpChallengeRepository;
  let sms: InMemorySmsSender;
  let afterCommit: FakeAfterCommit;
  let handler: RequestInvitationCodeHandler;

  beforeEach(() => {
    clock = new FixedClock(at('10:00:00'));
    challenges = new InMemoryOtpChallengeRepository();
    sms = new InMemorySmsSender();
    afterCommit = new FakeAfterCommit();
    // Seul Brice a une invitation en attente ; 6 70 11 22 33 n'en a qu'une échue, donc absente de la lecture.
    const pending = new InMemoryPendingInvitations().withPendingInvitation(PhoneNumber.parse(BRICE));
    handler = new RequestInvitationCodeHandler(
      challenges,
      new InMemoryOtpSendHistory(challenges),
      pending,
      new FixedOtpCodes(['482913', '105377', '222222', '333333', '444444', '555555', '666666']),
      fakeSecretHasher,
      sms,
      afterCommit.asAfterCommit(),
      clock,
      new SequentialIdGenerator(),
    );
  });

  const request = async (phone: string) => {
    const response = await handler.execute(new RequestInvitationCode(phone));
    await afterCommit.commit();
    return response;
  };
  const advance = (seconds: number) => clock.advanceMinutes(seconds / 60);

  it('refuses a number that is not Cameroonian, counting nothing and sending nothing', async () => {
    await expect(request('6 55 44 33 2')).rejects.toBeInstanceOf(InvalidValueError);

    expect(sms.sent).toEqual([]);
    expect(challenges.all()).toEqual([]);
  });

  it('texts a code that names no salon to a number with a pending invitation', async () => {
    await request(BRICE);

    expect(sms.lastTo(BRICE_E164)).toBe(
      'GoMeCoiffer : votre code pour rejoindre une équipe est 482913. Il expire dans 5 minutes. Ne le communiquez à personne.',
    );
    expect(challenges.all()).toMatchObject([{ purpose: 'INVITATION', status: 'ACTIVE' }]);
  });

  it('sends the SMS only after the response', async () => {
    await handler.execute(new RequestInvitationCode(BRICE));

    expect(sms.sent).toEqual([]);
    await afterCommit.commit();
    expect(sms.sent).toHaveLength(1);
  });

  it.each([
    ['a number with no invitation', NOBODY],
    ['a number whose only invitation has expired', EXPIRED_ONLY],
  ])('sends nothing to %s but records the request like a sent code', async (_label, phone) => {
    await request(phone);

    expect(sms.sent).toEqual([]);
    expect(challenges.all()).toHaveLength(1);
  });

  it('answers the same way whatever the invitations of the number', async () => {
    const forBrice = await request(BRICE);
    const forNobody = await request(NOBODY);

    expect(forBrice).toEqual({ maskedPhone: '6 55 •• •• 22', expiresInSeconds: 300, resendInSeconds: 60 });
    expect(forNobody).toEqual({ maskedPhone: '6 70 •• •• 01', expiresInSeconds: 300, resendInSeconds: 60 });
  });

  it('never keeps a six-digit code in the challenge of a number without invitation', async () => {
    await request(NOBODY);

    expect(JSON.stringify(challenges.all())).not.toMatch(/\b\d{6}\b/);
  });

  it('refuses a new code requested less than 60 seconds after the previous one, to the second', async () => {
    await request(BRICE);
    advance(59);
    await expect(request(BRICE)).rejects.toMatchObject({ code: 'OTP_RESEND_TOO_SOON' });

    advance(1);
    await expect(request(BRICE)).resolves.toBeDefined();
  });

  it('cancels the previous code when a new one is requested', async () => {
    await request(BRICE);
    advance(60);
    await request(BRICE);

    const [first, second] = challenges.all();
    expect(first!.status).toBe('SUPERSEDED');
    expect(second!.status).toBe('ACTIVE');
  });

  it('limits a number with no invitation like any other: 5 codes per hour', async () => {
    for (let i = 0; i < 5; i++) {
      await request(NOBODY);
      advance(60);
    }

    await expect(request(NOBODY)).rejects.toMatchObject({ code: 'OTP_TOO_MANY_REQUESTS' });
  });

  it('does not let password reset codes use up the invitation quota', async () => {
    const phone = PhoneNumber.parse(BRICE);
    for (let i = 0; i < 5; i++) {
      const reset = OtpChallenge.issue({
        id: `reset-${i}`,
        phone,
        purpose: 'PASSWORD_RESET',
        codeHash: 'x',
        now: new Date(at('09:10:00').getTime() + i * 60_000),
      });
      reset.supersede();
      await challenges.save(reset);
    }

    await expect(request(BRICE)).resolves.toBeDefined();
    expect(sms.sent).toHaveLength(1);
  });

  it('stops sending codes after 10 wrong codes in 24 hours', async () => {
    const phone = PhoneNumber.parse(BRICE);
    for (const [id, hoursAgo] of [
      ['first', 22],
      ['second', 20],
    ] as const) {
      const sentAt = new Date(clock.now().getTime() - hoursAgo * 3_600_000);
      const challenge = OtpChallenge.issue({
        id,
        phone,
        purpose: 'INVITATION',
        codeHash: 'h:111111',
        now: sentAt,
      });
      for (let i = 0; i < 5; i++)
        challenge.verify('000000', new Date(sentAt.getTime() + 1000), fakeSecretHasher);
      challenge.supersede();
      await challenges.save(challenge);
    }

    await expect(request(BRICE)).rejects.toMatchObject({ code: 'OTP_TOO_MANY_REQUESTS' });
  });

  it('shows nothing of an SMS outage: the second request is refused like for a number with no invitation', async () => {
    sms.outage = true;
    await request(BRICE);
    await request(NOBODY);
    advance(30);

    const forBrice = await request(BRICE).catch((error: Error) => error);
    const forNobody = await request(NOBODY).catch((error: Error) => error);

    expect(forBrice).toMatchObject({
      code: 'OTP_RESEND_TOO_SOON',
      message: expect.stringContaining('30 secondes'),
    });
    expect(forBrice).toEqual(forNobody);
  });
});
