import { beforeEach, describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { FixedClock, SequentialIdGenerator } from '../../../../test-support/fakes.js';
import { ProveInvitationPhone } from '../../application/commands/prove-invitation-phone/prove-invitation-phone.command.js';
import { ProveInvitationPhoneHandler } from '../../application/commands/prove-invitation-phone/prove-invitation-phone.handler.js';
import { RequestInvitationCode } from '../../application/commands/request-invitation-code/request-invitation-code.command.js';
import { RequestInvitationCodeHandler } from '../../application/commands/request-invitation-code/request-invitation-code.handler.js';
import {
  FakeAfterCommit,
  FixedDeviceTokens,
  FixedOtpCodes,
  fakeSecretHasher,
  InMemoryOtpChallengeRepository,
  InMemoryOtpSendHistory,
  InMemoryPendingInvitations,
  InMemoryPhoneProofRepository,
  InMemorySmsSender,
} from '../fakes/identity-fakes.js';

const at = (time: string) => new Date(`2026-11-20T${time}+01:00`);
const BRICE = '6 55 44 33 22';
const NOBODY = '6 70 00 00 01';

describe('Proving a phone number with the code received to join a salon', () => {
  let clock: FixedClock;
  let challenges: InMemoryOtpChallengeRepository;
  let proofs: InMemoryPhoneProofRepository;
  let request: (phone: string) => Promise<unknown>;
  let prove: ProveInvitationPhoneHandler;

  beforeEach(() => {
    clock = new FixedClock(at('10:00:00'));
    challenges = new InMemoryOtpChallengeRepository();
    proofs = new InMemoryPhoneProofRepository();
    const afterCommit = new FakeAfterCommit();
    const ids = new SequentialIdGenerator();
    const requestCode = new RequestInvitationCodeHandler(
      challenges,
      new InMemoryOtpSendHistory(challenges),
      new InMemoryPendingInvitations().withPendingInvitation(PhoneNumber.parse(BRICE)),
      new FixedOtpCodes(['482913', '105377', '222222']),
      fakeSecretHasher,
      new InMemorySmsSender(),
      afterCommit.asAfterCommit(),
      clock,
      ids,
    );
    request = (phone) => requestCode.execute(new RequestInvitationCode(phone));
    prove = new ProveInvitationPhoneHandler(
      challenges,
      proofs,
      new FixedDeviceTokens(['token-1', 'token-2']),
      fakeSecretHasher,
      clock,
      ids,
    );
  });

  const enter = (code: string, phone = BRICE) => prove.execute(new ProveInvitationPhone(phone, code));

  it('hands out a proof of the number valid for 15 minutes, keeping only the fingerprint of its token', async () => {
    await request(BRICE);

    const proof = await enter('482913');

    expect(proof).toEqual({ token: 'token-1', provenUntil: '2026-11-20T09:15:00.000Z' });
    expect(proofs.all()).toMatchObject([{ phone: '+237655443322', purpose: 'INVITATION', tokenHash: 'h:phone-proof:token-1' }]);
    expect(JSON.stringify(proofs.all())).not.toContain('"token-1"');
  });

  it('fingerprints the token in its own domain, so a code hash can never stand for a proof', async () => {
    await request(BRICE);
    await enter('482913');

    expect(proofs.all()[0]!.tokenHash).not.toBe(fakeSecretHasher.hash('token-1'));
  });

  it('uses the code up: the same code cannot be entered twice', async () => {
    await request(BRICE);
    await enter('482913');

    await expect(enter('482913')).rejects.toMatchObject({ refusal: { code: 'OTP_NO_LONGER_VALID' } });
  });

  it('refuses a wrong code, counts the attempt and hands out nothing', async () => {
    await request(BRICE);

    await expect(enter('000000')).rejects.toMatchObject({
      refusal: { code: 'OTP_INCORRECT', message: expect.stringContaining('4 essais') },
    });

    expect(challenges.all()[0]).toMatchObject({ attempts: 1, status: 'ACTIVE' });
    expect(proofs.all()).toEqual([]);
  });

  it('refuses an expired code at the exact minute', async () => {
    await request(BRICE);
    clock.set(at('10:04:59'));
    await expect(enter('482913')).resolves.toBeDefined();
    await request(BRICE).catch(() => undefined);

    clock.set(at('10:10:00'));
    await expect(enter('105377')).rejects.toMatchObject({ refusal: { code: 'OTP_EXPIRED' } });
  });

  it('refuses even the right code once the 5 attempts are used', async () => {
    await request(BRICE);
    for (let i = 0; i < 5; i++) await enter('000000').catch(() => undefined);

    await expect(enter('482913')).rejects.toMatchObject({ refusal: { code: 'OTP_ATTEMPTS_EXHAUSTED' } });
  });

  it('no longer accepts a code replaced by a newer one', async () => {
    await request(BRICE);
    clock.set(at('10:01:00'));
    await request(BRICE);

    await expect(enter('482913')).rejects.toMatchObject({
      refusal: { code: 'OTP_INCORRECT', message: expect.stringContaining('4 essais') },
    });
  });

  it('answers a number with no invitation like a wrong code, whatever code is entered', async () => {
    await request(NOBODY);

    await expect(enter('482913', NOBODY)).rejects.toMatchObject({
      refusal: { code: 'OTP_INCORRECT', message: expect.stringContaining('4 essais') },
    });
    expect(proofs.all()).toEqual([]);
  });

  it('refuses when no code was requested', async () => {
    await expect(enter('482913')).rejects.toMatchObject({ refusal: { code: 'OTP_NO_LONGER_VALID' } });
  });
});
