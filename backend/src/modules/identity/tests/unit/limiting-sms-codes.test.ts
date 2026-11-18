import { describe, expect, it } from 'vitest';
import { assertCanSendCode } from '../../domain/services/otp-sending-policy.js';
import type { CodeSend } from '../../domain/value-objects/code-send.js';

const at = (time: string, day = '18') => new Date(`2026-11-${day}T${time}+01:00`);
const sent = (time: string, failedAttempts = 0, day = '18'): CodeSend => ({
  sentAt: at(time, day),
  failedAttempts,
});

const TOO_MANY = {
  code: 'OTP_TOO_MANY_REQUESTS',
  message: "Trop de codes demandés pour ce numéro. Réessayez dans une heure ou contactez l'assistance.",
};

describe('Limiting the SMS codes sent to a phone number', () => {
  it('lets the first code of the hour go', () => {
    expect(() => assertCanSendCode([], at('10:00:00'))).not.toThrow();
  });

  it.each([
    ['10:00:59', 'refused', 1],
    ['10:01:00', 'accepted', 0],
  ])('after a code sent at 10:00:00, a new one requested at %s is %s', (time, outcome, secondsLeft) => {
    const attempt = () => assertCanSendCode([sent('10:00:00')], at(time));
    if (outcome === 'accepted') expect(attempt).not.toThrow();
    else
      expect(attempt).toThrow(
        expect.objectContaining({
          code: 'OTP_RESEND_TOO_SOON',
          message: `Un code vient d'être envoyé. Vous pourrez en demander un autre dans ${secondsLeft} secondes.`,
        }),
      );
  });

  it('refuses a 6th code within the same hour', () => {
    const fiveSinceTenPastNine = ['09:10', '09:20', '09:30', '09:40', '09:50'].map((t) => sent(`${t}:00`));

    expect(() => assertCanSendCode(fiveSinceTenPastNine, at('10:00:00'))).toThrow(
      expect.objectContaining(TOO_MANY),
    );
  });

  it('forgets the codes sent more than an hour ago for the hourly limit', () => {
    const fiveEarlyMorning = ['08:10', '08:20', '08:30', '08:40', '08:50'].map((t) => sent(`${t}:00`));

    expect(() => assertCanSendCode(fiveEarlyMorning, at('10:00:00'))).not.toThrow();
  });

  it('refuses an 11th code within 24 hours, even spread over the day', () => {
    const tenSinceYesterday = ['11', '13', '15', '17', '19', '21', '23'].map((h) =>
      sent(`${h}:00:00`, 0, '17'),
    );
    tenSinceYesterday.push(sent('01:00:00'), sent('03:00:00'), sent('05:00:00'));

    expect(() => assertCanSendCode(tenSinceYesterday, at('10:00:00'))).toThrow(
      expect.objectContaining(TOO_MANY),
    );
  });

  it('stops sending codes to a number after 10 wrong codes within 24 hours', () => {
    const wrongTwiceEachTime = ['02', '04', '06', '08', '09'].map((h) => sent(`${h}:00:00`, 2));

    expect(() => assertCanSendCode(wrongTwiceEachTime, at('10:00:00'))).toThrow(
      expect.objectContaining(TOO_MANY),
    );
  });

  it('forgets wrong codes older than 24 hours', () => {
    const tenWrongTheDayBefore = [sent('09:00:00', 5, '17'), sent('09:30:00', 5, '17')];

    expect(() => assertCanSendCode(tenWrongTheDayBefore, at('10:00:00'))).not.toThrow();
  });
});
