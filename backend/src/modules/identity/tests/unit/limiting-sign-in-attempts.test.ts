import { describe, expect, it } from 'vitest';
import { assessSignIn } from '../../domain/services/sign-in-attempt-policy.js';
import type { SignInAttempt } from '../../domain/value-objects/sign-in-attempt.js';

const PAUL = '+237699001122';
const HOME = '41.202.10.1';
const at = (time: string, day = '18') => new Date(`2026-11-${day}T${time}+01:00`);

const failure = (time: string, over: Partial<SignInAttempt> = {}): SignInAttempt => ({
  phone: PAUL,
  networkAddress: HOME,
  at: at(time),
  succeeded: false,
  fromKnownDevice: false,
  ...over,
});
const success = (time: string): SignInAttempt => ({ ...failure(time), succeeded: true });
const failures = (times: string[], over: Partial<SignInAttempt> = {}) => times.map((t) => failure(t, over));

const check = (attempts: SignInAttempt[], now: Date, over: { known?: boolean; address?: string } = {}) =>
  assessSignIn({
    phone: PAUL,
    networkAddress: over.address ?? HOME,
    attempts,
    fromKnownDevice: over.known ?? false,
    now,
  });

const BURST = ['10:00:00', '10:00:10', '10:00:20', '10:00:30', '10:00:40'];

describe('Limiting the password attempts on a phone number', () => {
  it('lets a number with no history sign in', () => {
    expect(check([], at('10:00:00'))).toBeNull();
  });

  it.each([
    [4, null],
    [5, { reason: 'PHONE_SHORT', minutes: 15 }],
  ])('after %i wrong passwords within 15 minutes from new devices: %j', (count, expected) => {
    expect(check(failures(BURST.slice(0, count)), at('10:00:40'))).toEqual(expected);
  });

  it('does not block when the 5 wrong passwords are spread over 15 minutes or more', () => {
    const slow = failures(['10:00:00', '10:04:00', '10:08:00', '10:12:00', '10:15:00']);

    expect(check(slow, at('10:15:30'))).toBeNull();
  });

  it('blocks when the 5th wrong password comes 14 min 59 s after the first', () => {
    const justInTime = failures(['10:00:00', '10:04:00', '10:08:00', '10:12:00', '10:14:59']);

    expect(check(justInTime, at('10:15:00'))).toEqual({ reason: 'PHONE_SHORT', minutes: 15 });
  });

  it.each([
    ['10:18:59', { reason: 'PHONE_SHORT', minutes: 1 }],
    ['10:19:00', null],
  ])('with the 5th wrong password at 10:04:00, an attempt at %s gives %j', (time, expected) => {
    const five = failures(['10:00:00', '10:01:00', '10:02:00', '10:03:00', '10:04:00']);

    expect(check(five, at(time))).toEqual(expected);
  });

  it('rounds the remaining wait up to the next minute', () => {
    const five = failures(['09:55:00', '09:56:00', '09:57:00', '09:58:00', '09:59:00']);

    expect(check(five, at('10:00:00'))).toEqual({ reason: 'PHONE_SHORT', minutes: 14 });
    expect(check(five, at('10:00:01'))).toEqual({ reason: 'PHONE_SHORT', minutes: 14 });
    expect(check(five, at('10:13:59'))).toEqual({ reason: 'PHONE_SHORT', minutes: 1 });
  });

  it('forgets the failures that came before a successful sign-in', () => {
    const attempts = [
      ...failures(['09:50:00', '09:51:00', '09:52:00', '09:53:00']),
      success('09:54:00'),
      failure('09:59:00'),
    ];

    expect(check(attempts, at('10:00:00'))).toBeNull();
  });

  it('keeps counting the 5 wrong passwords that came after a success', () => {
    const attempts = [
      success('09:00:00'),
      ...failures(['09:50:00', '09:51:00', '09:52:00', '09:53:00', '09:54:00']),
    ];

    expect(check(attempts, at('10:00:00'))).toEqual({ reason: 'PHONE_SHORT', minutes: 9 });
  });

  it('counts the wrong passwords typed at the very instant of a success, as it cannot tell which came first', () => {
    const attempts = [
      success('10:00:00'),
      ...failures(['10:00:00', '10:00:00', '10:00:00', '10:00:00', '10:00:00']),
    ];

    expect(check(attempts, at('10:00:01'))).toEqual({ reason: 'PHONE_SHORT', minutes: 15 });
  });

  it('ignores the wrong passwords typed from a recognised device', () => {
    expect(check(failures(BURST, { fromKnownDevice: true }), at('10:00:50'))).toBeNull();
  });

  it('never blocks a recognised device, even when the number is blocked', () => {
    expect(check(failures(BURST), at('10:00:50'), { known: true })).toBeNull();
  });

  it('only counts the failures of the number being tried', () => {
    const others = failures(BURST, { phone: '+237655443322', networkAddress: '10.0.0.9' });

    expect(check(others, at('10:00:50'))).toBeNull();
  });
});

describe('Limiting the password attempts over 24 hours', () => {
  /** Un échec toutes les 20 minutes depuis hier 11 h 00 : jamais 5 en moins de 15 minutes. */
  const spreadOver24h = (count: number): SignInAttempt[] =>
    Array.from({ length: count }, (_, i) => ({
      ...failure('00:00:00'),
      at: new Date(at('11:00:00', '17').getTime() + i * 20 * 60_000),
    }));

  it.each([
    [19, null],
    [20, { reason: 'PHONE_DAILY' }],
  ])('with %i wrong passwords in the last 24 hours: %j', (count, expected) => {
    expect(check(spreadOver24h(count), at('10:00:00'))).toEqual(expected);
  });

  it('lets the oldest failure leave the 24-hour window to the second', () => {
    const twenty = spreadOver24h(20); // le plus ancien : hier 11:00:00 ; le plus récent : hier 17:40

    expect(check(twenty, at('10:59:59'))).toEqual({ reason: 'PHONE_DAILY' });
    expect(check(twenty, at('11:00:00'))).toBeNull();
  });

  it('is not reset by a successful sign-in', () => {
    const attempts = [...spreadOver24h(20), success('09:00:00')];

    expect(check(attempts, at('10:00:00'))).toEqual({ reason: 'PHONE_DAILY' });
  });

  it('does not apply to a recognised device', () => {
    expect(check(spreadOver24h(20), at('10:00:00'), { known: true })).toBeNull();
  });

  it('wins over the 15-minute block, which would announce a shorter wait', () => {
    const burst = failures(['09:56:00', '09:57:00', '09:58:00', '09:59:00', '09:59:30']);

    expect(check([...spreadOver24h(15), ...burst], at('10:00:00'))).toEqual({ reason: 'PHONE_DAILY' });
  });
});

describe('Limiting the failed sign-ins from one network address', () => {
  const fromOtherNumbers = (count: number): SignInAttempt[] =>
    Array.from({ length: count }, (_, i) =>
      failure('09:10:00', { phone: `+2376000000${String(i).padStart(2, '0')}` }),
    );

  it.each([
    [29, null],
    [30, { reason: 'NETWORK' }],
  ])('with %i failures since 9:10 from this address on other numbers: %j', (count, expected) => {
    expect(check(fromOtherNumbers(count), at('10:00:00'))).toEqual(expected);
  });

  it('forgets the failures older than one hour, to the second', () => {
    const thirty = fromOtherNumbers(30);

    expect(check(thirty, at('10:09:59'))).toEqual({ reason: 'NETWORK' });
    expect(check(thirty, at('10:10:00'))).toBeNull();
  });

  it('does not count the failures of recognised devices, which shared mobile networks produce', () => {
    const trusted = fromOtherNumbers(30).map((a) => ({ ...a, fromKnownDevice: true }));

    expect(check(trusted, at('10:00:00'))).toBeNull();
  });

  it('does not count the successes', () => {
    const successes = fromOtherNumbers(30).map((a) => ({ ...a, succeeded: true }));

    expect(check(successes, at('10:00:00'))).toBeNull();
  });

  it('does not block a recognised device', () => {
    expect(check(fromOtherNumbers(30), at('10:00:00'), { known: true })).toBeNull();
  });

  it('only counts the failures of this address', () => {
    const elsewhere = fromOtherNumbers(30).map((a) => ({ ...a, networkAddress: '10.9.9.9' }));

    expect(check(elsewhere, at('10:00:00'))).toBeNull();
  });
});

describe('Lifting the blocks of a phone number after a password reset', () => {
  const reset = (time: string): SignInAttempt => ({ ...success(time), networkAddress: '', passwordReset: true });
  const twentyDaily = () =>
    Array.from({ length: 20 }, (_, i) => failure(`09:${String(10 + i).padStart(2, '0')}:00`, {}));

  it('forgets the burst of failures entered before the reset', () => {
    const attempts = [...failures(BURST), reset('10:00:50')];

    expect(check(attempts, at('10:05:00'))).toBeNull();
  });

  it('forgets the 24-hour ceiling reached before the reset', () => {
    const attempts = [...twentyDaily(), reset('09:45:00')];

    expect(check(attempts, at('10:00:00'))).toBeNull();
  });

  it('counts again the failures entered after the reset', () => {
    const attempts = [reset('09:56:00'), ...failures(['09:57:00', '09:57:10', '09:57:20', '09:57:30', '09:57:40'])];

    expect(check(attempts, at('10:00:00'))).toEqual({ reason: 'PHONE_SHORT', minutes: 13 });
  });

  it('treats a failure entered at the very second of the reset as entered before it', () => {
    const everyFourMinutes = Array.from({ length: 19 }, (_, i) =>
      failure('10:00:00', { at: new Date(at('10:04:00').getTime() + i * 4 * 60_000) }),
    );
    const attempts = [failure('10:00:00'), reset('10:00:00'), ...everyFourMinutes];

    expect(check(attempts, at('11:30:00'))).toBeNull();
  });

  it('keeps the block of a network address, which concerns other numbers', () => {
    const fromOtherNumbers = Array.from({ length: 30 }, (_, i) =>
      failure('09:30:00', { phone: `+2376000000${String(i).padStart(2, '0')}` }),
    );

    expect(check([...fromOtherNumbers, reset('10:00:00')], at('10:00:30'))).toEqual({ reason: 'NETWORK' });
  });
});
