import { describe, expect, it } from 'vitest';
import { assertCanSendCode } from '../../domain/otp-sending-policy.js';

const at = (time: string) => new Date(`2026-11-18T${time}+01:00`);

describe('Limiting the SMS codes sent to a phone number', () => {
  it('lets the first code of the hour go', () => {
    expect(() => assertCanSendCode([], at('10:00:00'))).not.toThrow();
  });

  it.each([
    ['10:00:59', 'refused', 1],
    ['10:01:00', 'accepted', 0],
  ])('after a code sent at 10:00:00, a new one requested at %s is %s', (time, outcome, secondsLeft) => {
    const attempt = () => assertCanSendCode([at('10:00:00')], at(time));
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
    const fiveSinceTenPastNine = ['09:10', '09:20', '09:30', '09:40', '09:50'].map((t) => at(`${t}:00`));

    expect(() => assertCanSendCode(fiveSinceTenPastNine, at('10:00:00'))).toThrow(
      expect.objectContaining({
        code: 'OTP_TOO_MANY_REQUESTS',
        message: "Trop de codes demandés pour ce numéro. Réessayez dans une heure ou contactez l'assistance.",
      }),
    );
  });

  it('forgets the codes sent more than an hour ago', () => {
    const fiveEarlyMorning = ['08:10', '08:20', '08:30', '08:40', '08:50'].map((t) => at(`${t}:00`));

    expect(() => assertCanSendCode(fiveEarlyMorning, at('10:00:00'))).not.toThrow();
  });
});
