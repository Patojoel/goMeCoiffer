import { describe, expect, it } from 'vitest';
import { InvalidValueError } from '../../domain/errors.js';
import { Money } from '../../domain/money.js';
import { PhoneNumber } from '../../domain/phone-number.js';
import { TimeRange } from '../../domain/time-range.js';

const at = (iso: string) => new Date(iso);

describe('Amounts in FCFA', () => {
  it('adds two prices', () => {
    expect(Money.xaf(2_000).add(Money.xaf(1_500)).amount).toBe(3_500);
  });

  it.each([[-1], [10.5], [Number.NaN]])(
    'refuses %s, which is not a whole positive amount of FCFA',
    (value) => {
      expect(() => Money.xaf(value)).toThrow(InvalidValueError);
    },
  );

  it('compares two amounts by value', () => {
    expect(Money.xaf(5_000).equals(Money.xaf(5_000))).toBe(true);
  });
});

describe('Time ranges of the planning', () => {
  const tenToTenThirty = TimeRange.of(at('2027-01-12T09:00:00Z'), at('2027-01-12T09:30:00Z'));

  it('refuses a range that ends before or when it starts', () => {
    expect(() => TimeRange.of(at('2027-01-12T09:30:00Z'), at('2027-01-12T09:30:00Z'))).toThrow(
      InvalidValueError,
    );
  });

  it('knows its duration in minutes', () => {
    expect(tenToTenThirty.durationInMinutes).toBe(30);
  });

  it('overlaps a booking that starts before it ends', () => {
    const tenFifteen = TimeRange.of(at('2027-01-12T09:15:00Z'), at('2027-01-12T09:45:00Z'));
    expect(tenToTenThirty.overlaps(tenFifteen)).toBe(true);
  });

  it('does not overlap the booking that starts exactly when it ends', () => {
    const tenThirty = TimeRange.of(at('2027-01-12T09:30:00Z'), at('2027-01-12T10:00:00Z'));
    expect(tenToTenThirty.overlaps(tenThirty)).toBe(false);
  });

  it('contains a shorter range inside it', () => {
    const inside = TimeRange.of(at('2027-01-12T09:05:00Z'), at('2027-01-12T09:25:00Z'));
    expect(tenToTenThirty.contains(inside)).toBe(true);
  });
});

describe('Cameroonian phone numbers', () => {
  it.each([
    ['677 12 34 56', '+237677123456'],
    ['+237 6 99 00 11 22', '+237699001122'],
    ['00237655443322', '+237655443322'],
  ])('normalises %s to %s', (input, expected) => {
    expect(PhoneNumber.parse(input).value).toBe(expected);
  });

  it.each([['12345'], ['+33612345678'], ['6771234567']])('refuses %s', (input) => {
    expect(() => PhoneNumber.parse(input)).toThrow(InvalidValueError);
  });
});
