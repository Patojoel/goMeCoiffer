import { describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { OtpChallenge } from '../../domain/aggregates/otp-challenge.js';
import { fakeSecretHasher } from '../fakes/identity-fakes.js';

const MIREILLE = PhoneNumber.parse('6 77 12 34 56');
const at = (time: string) => new Date(`2026-11-18T${time}+01:00`);

const codeSentAt10h = () =>
  OtpChallenge.issue({
    id: '0195f000-0000-7000-8000-00000000c001',
    phone: MIREILLE,
    purpose: 'SIGN_UP',
    codeHash: fakeSecretHasher.hash('482913'),
    now: at('10:00:00'),
  });

describe('Verifying a sign-up code received by SMS', () => {
  it('refuses a wrong code and says how many attempts are left', () => {
    const challenge = codeSentAt10h();

    const result = challenge.verify('000000', at('10:01:00'), fakeSecretHasher);

    expect(result).toEqual({ accepted: false, refusal: expect.objectContaining({ code: 'OTP_INCORRECT' }) });
    expect(result.accepted || result.refusal.message).toBe('Code incorrect. Il vous reste 4 essais.');
  });

  it.each([
    ['10:04:59', true],
    ['10:05:01', false],
  ])('accepts the right code only for 5 minutes (checked at %s)', (time, accepted) => {
    expect(codeSentAt10h().verify('482913', at(time), fakeSecretHasher).accepted).toBe(accepted);
  });

  it('says an expired code must be requested again', () => {
    const result = codeSentAt10h().verify('482913', at('10:05:01'), fakeSecretHasher);
    expect(result.accepted || result.refusal.code).toBe('OTP_EXPIRED');
  });

  it('refuses even the right code after 5 wrong attempts', () => {
    const challenge = codeSentAt10h();
    for (const wrong of ['000001', '000002', '000003', '000004', '000005'])
      challenge.verify(wrong, at('10:01:00'), fakeSecretHasher);

    const result = challenge.verify('482913', at('10:01:30'), fakeSecretHasher);

    expect(result.accepted || result.refusal.message).toBe("Trop d'essais. Demandez un nouveau code.");
  });

  it('accepts a code only once', () => {
    const challenge = codeSentAt10h();
    expect(challenge.verify('482913', at('10:01:00'), fakeSecretHasher).accepted).toBe(true);

    expect(challenge.verify('482913', at('10:01:10'), fakeSecretHasher).accepted).toBe(false);
  });

  it('no longer accepts a code replaced by a newer one', () => {
    const challenge = codeSentAt10h();
    challenge.supersede();

    expect(challenge.verify('482913', at('10:01:00'), fakeSecretHasher).accepted).toBe(false);
  });
});
