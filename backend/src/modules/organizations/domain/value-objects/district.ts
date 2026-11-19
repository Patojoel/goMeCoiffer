import { boundedText } from './bounded-text.js';

export class District {
  private constructor(readonly value: string) {}

  static create(raw: string): District {
    return new District(boundedText(raw, 2, 60, 'Le quartier doit compter de 2 à 60 caractères.'));
  }
}
