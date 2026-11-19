import { boundedText } from './bounded-text.js';

export class SalonName {
  private constructor(readonly value: string) {}

  static create(raw: string): SalonName {
    return new SalonName(boundedText(raw, 2, 60, 'Le nom du salon doit compter de 2 à 60 caractères.'));
  }
}
