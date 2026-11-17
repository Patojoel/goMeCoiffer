import { InvalidValueError } from './errors.js';

/** Numéro camerounais normalisé en E.164 (+237 suivi de 9 chiffres). */
export class PhoneNumber {
  private constructor(readonly value: string) {}

  static parse(input: string): PhoneNumber {
    const digits = input
      .replace(/[\s.-]/g, '')
      .replace(/^\+/, '')
      .replace(/^00/, '');
    const national = digits.startsWith('237') ? digits.slice(3) : digits;
    if (!/^[26]\d{8}$/.test(national)) {
      throw new InvalidValueError(
        'Numéro de téléphone camerounais invalide (9 chiffres, ex. 6 77 12 34 56).',
      );
    }
    return new PhoneNumber(`+237${national}`);
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
