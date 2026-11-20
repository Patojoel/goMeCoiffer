import { describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { User } from '../../domain/aggregates/user.js';
import { CollaboratorDetails } from '../../domain/value-objects/collaborator-details.js';
import { commonPasswords } from '../fakes/identity-fakes.js';

const BRICE = PhoneNumber.parse('6 55 44 33 22');
const PROVEN_AT = new Date('2026-11-20T10:02:00+01:00');
const NOW = new Date('2026-11-20T10:05:00+01:00');
const details = (over: Partial<{ name: string; password: string; termsAccepted: boolean }> = {}) =>
  CollaboratorDetails.create(
    { name: 'Brice Nana', password: 'Wouri-Barber-2027', termsAccepted: true, ...over },
    BRICE,
    commonPasswords,
  );

describe('Creating the account of a collaborator who joins a salon', () => {
  it('verifies the number at the instant of the proof and dates the terms at the acceptance', () => {
    const user = User.registerCollaborator({
      id: '0195f000-0000-7000-8000-00000000a010',
      phone: BRICE,
      name: 'Brice Nana',
      passwordHash: 'argon:x',
      provenAt: PROVEN_AT,
      now: NOW,
    });

    expect(user.snapshot()).toMatchObject({
      phone: '+237655443322',
      name: 'Brice Nana',
      email: null,
      phoneVerifiedAt: PROVEN_AT,
      termsAcceptedAt: NOW,
      credentialsVersion: 1,
    });
  });

  it('completes a light client account without replacing its identity', () => {
    const light = User.restore({
      id: '0195f000-0000-7000-8000-00000000a011',
      phone: BRICE.value,
      name: null,
      email: null,
      passwordHash: null,
      phoneVerifiedAt: PROVEN_AT,
      termsAcceptedAt: null,
      createdAt: PROVEN_AT,
      credentialsVersion: 1,
      version: 1,
    });

    light.completeAsCollaborator({ name: 'Brice Nana', passwordHash: 'argon:x', provenAt: PROVEN_AT, now: NOW });

    expect(light.snapshot()).toMatchObject({ id: light.id, name: 'Brice Nana', passwordHash: 'argon:x', termsAcceptedAt: NOW });
    expect(light.isStaffAccount).toBe(true);
  });

  it.each([
    ['a name of one character', { name: 'B' }, 'INVALID_VALUE'],
    ['a name of 81 characters', { name: 'x'.repeat(81) }, 'INVALID_VALUE'],
    ['terms not accepted', { termsAccepted: false }, 'TERMS_NOT_ACCEPTED'],
    ['a password of 9 characters', { password: 'salon2026' }, 'PASSWORD_TOO_SHORT'],
    ['a common password', { password: 'motdepasse123' }, 'PASSWORD_TOO_COMMON'],
    ['a password containing the number', { password: '655443322ab' }, 'PASSWORD_CONTAINS_PHONE'],
  ])('refuses %s', (_label, over, code) => {
    expect(() => details(over)).toThrow(expect.objectContaining({ code }));
  });

  it('accepts a name of two characters and cleans its spaces', () => {
    expect(details({ name: 'Bo' }).name).toBe('Bo');
    expect(details({ name: '  Brice   Nana ' }).name).toBe('Brice Nana');
  });
});
