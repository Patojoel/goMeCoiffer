import { boundedText } from './bounded-text.js';

export class Landmark {
  private constructor(readonly value: string) {}

  static create(raw: string): Landmark {
    return new Landmark(boundedText(raw, 5, 160, 'Le point de repère doit compter de 5 à 160 caractères.'));
  }
}
