import { describe, expect, it } from 'vitest';
import {
  formatCameroonPhone,
  formatDateFr,
  formatDateTimeInZone,
  formatIsoDateToDisplayFr,
  formatTimeInZone,
  formatXaf,
  normalizeCameroonPhone,
} from '../format.js';

const plainSpaces = (s: string) => s.replace(/[\s\u202f\u00a0]/g, ' ');

describe('Salon value formatting and Cameroon phone normalization', () => {
  it('formats amounts in whole FCFA without decimals', () => {
    expect(plainSpaces(formatXaf(15000))).toBe('15 000 FCFA');
    expect(plainSpaces(formatXaf(0))).toBe('0 FCFA');
  });

  it('formats instants in the salon timezone rather than the device timezone', () => {
    const instant = '2026-03-10T23:30:00.000Z';

    expect(formatTimeInZone(instant, 'Africa/Douala')).toBe('00:30');
    expect(formatTimeInZone(instant, 'America/New_York')).toBe('19:30');
  });

  it('normalizes valid Cameroon mobile and fixed numbers to E.164 and rejects invalid ones', () => {
    expect(normalizeCameroonPhone('6 99 00 11 22')).toBe('+237699001122');
    expect(normalizeCameroonPhone('+237 6-55.44.33.22')).toBe('+237655443322');
    expect(normalizeCameroonPhone('237222112233')).toBe('+237222112233');
    expect(normalizeCameroonPhone('7 99 00 11 22')).toBeNull();
    expect(normalizeCameroonPhone('6990011')).toBeNull();
  });

  it('formats a Cameroon number for display', () => {
    expect(formatCameroonPhone('+237699001122')).toBe('6 99 00 11 22');
  });

  it('formats ISO instants and calendar YYYY-MM-DD strings cleanly in salon timezone', () => {
    const instant = '2026-11-20T23:30:00.000Z';
    expect(formatDateFr(instant, 'Africa/Douala')).toContain('21 nov. 2026');
    expect(formatDateTimeInZone(instant, 'Africa/Douala')).toContain('00:30');
    expect(formatIsoDateToDisplayFr('2026-11-20')).toContain('20');
    expect(formatIsoDateToDisplayFr('invalid-date')).toBe('invalid-date');
  });
});
