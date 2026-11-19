import { describe, expect, it } from 'vitest';
import { KnownDevice } from '../../domain/aggregates/known-device.js';
import { assessSignIn } from '../../domain/services/sign-in-attempt-policy.js';
import { passwordResetMark, type SignInAttempt } from '../../domain/value-objects/sign-in-attempt.js';

const PAUL = '+237699001122';
const NOW = new Date('2026-11-18T10:00:00+01:00');

const failuresFrom = (count: number, phoneOf: (i: number) => string): SignInAttempt[] =>
  Array.from({ length: count }, (_, i) => ({
    phone: phoneOf(i),
    networkAddress: '41.202.10.1',
    at: new Date(NOW.getTime() - i * 1_000),
    succeeded: false,
    fromKnownDevice: false,
  }));
const assess = (attempts: SignInAttempt[]) =>
  assessSignIn({ phone: PAUL, networkAddress: '41.202.10.1', attempts, fromKnownDevice: false, now: NOW });

describe('Deciding whether a sign-in block is worth an audit trace', () => {
  it('traces a block that targets one phone number', () => {
    const five = failuresFrom(5, () => PAUL);

    expect(assess(five)).toMatchObject({ block: { reason: 'PHONE_SHORT' }, auditable: true });
  });

  it('does not trace a block that only targets a shared network address', () => {
    const thirtyOtherNumbers = failuresFrom(30, (i) => `+2376990${String(i).padStart(5, '0')}`);

    expect(assess(thirtyOtherNumbers)).toMatchObject({ block: { reason: 'NETWORK' }, auditable: false });
  });

  it('has nothing to trace when nothing is blocked', () => {
    expect(assess([])).toEqual({ block: null, auditable: false });
  });
});

describe('Counting the failures of a known device', () => {
  const device = (now: Date) => KnownDevice.recognize({ id: 'd1', userId: 'u1', tokenHash: 'h', now });

  it('ignores a failure from a device that is no longer recognised', () => {
    const lapsed = device(new Date('2026-01-01T10:00:00Z'));

    lapsed.recordFailure(NOW);

    expect(lapsed.snapshot().failedAttempts).toBe(0);
  });

  it('counts a failure from a recognised device', () => {
    const known = device(NOW);

    known.recordFailure(NOW);

    expect(known.snapshot().failedAttempts).toBe(1);
  });
});

describe('Marking a password reset in the sign-in history', () => {
  it('is a success without network address, from no known device, that clears the earlier failures', () => {
    expect(passwordResetMark(PAUL, NOW)).toEqual({
      phone: PAUL,
      networkAddress: '',
      at: NOW,
      succeeded: true,
      fromKnownDevice: false,
      passwordReset: true,
    });
  });
});
