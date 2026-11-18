import { describe, expect, it } from 'vitest';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import { NewPassword } from '../../domain/new-password.js';
import { commonPasswords } from '../fakes/identity-fakes.js';

const MIREILLE = PhoneNumber.parse('6 77 12 34 56');

describe('Choosing a staff password', () => {
  it.each([
    ['salon2026', 'PASSWORD_TOO_SHORT', 'Le mot de passe doit compter au moins 10 caractères.'],
    [
      'motdepasse123',
      'PASSWORD_TOO_COMMON',
      'Ce mot de passe est trop courant : choisissez une phrase propre à vous.',
    ],
    [
      '677123456ab',
      'PASSWORD_CONTAINS_PHONE',
      'Le mot de passe ne doit pas contenir votre numéro de téléphone.',
    ],
    ['x'.repeat(129), 'PASSWORD_TOO_LONG', 'Le mot de passe ne peut pas dépasser 128 caractères.'],
  ])('refuses "%s"', (raw, code, message) => {
    expect(() => NewPassword.create(raw, MIREILLE, commonPasswords)).toThrow(
      expect.objectContaining({ code, message }),
    );
  });

  it.each([['Akwa-Tresses-27'], ['x'.repeat(10)], ['x'.repeat(128)]])('accepts "%s"', (raw) => {
    expect(NewPassword.create(raw, MIREILLE, commonPasswords).value).toBe(raw);
  });

  it('never shows the password when printed', () => {
    expect(String(NewPassword.create('Akwa-Tresses-27', MIREILLE, commonPasswords))).toBe('NewPassword[***]');
  });
});
