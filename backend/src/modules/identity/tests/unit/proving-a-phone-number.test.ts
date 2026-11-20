import { describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { PhoneProof } from '../../domain/aggregates/phone-proof.js';
import { SmsMessages } from '../../domain/messages/sms-messages.js';

const PROVEN_AT = new Date('2026-11-20T10:02:00+01:00');
const at = (seconds: number) => new Date(PROVEN_AT.getTime() + seconds * 1000);
const aProof = () =>
  PhoneProof.issue({
    id: '0195f000-0000-7000-8000-00000000f001',
    phone: PhoneNumber.parse('6 55 44 33 22'),
    purpose: 'INVITATION',
    tokenHash: 'hash-of-the-token',
    now: PROVEN_AT,
  });

describe('Proving that a phone number belongs to the person', () => {
  it('is valid for 15 minutes, to the second', () => {
    expect(aProof().isValidFor('INVITATION', at(14 * 60 + 59))).toBe(true);
    expect(aProof().isValidFor('INVITATION', at(15 * 60))).toBe(false);
  });

  it('is only valid for the purpose it was issued for', () => {
    expect(aProof().isValidFor('PASSWORD_RESET', at(1))).toBe(false);
  });

  it('remembers the number and the instant of the proof', () => {
    expect(aProof().snapshot()).toMatchObject({ phone: '+237655443322', provenAt: PROVEN_AT });
  });

  it('texts a code that names no salon (D-046)', () => {
    expect(SmsMessages.invitationCode('482913')).toBe(
      'GoMeCoiffer : votre code pour rejoindre une équipe est 482913. Il expire dans 5 minutes. Ne le communiquez à personne.',
    );
  });
});
