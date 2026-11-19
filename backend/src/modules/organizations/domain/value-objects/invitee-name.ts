import { boundedText } from './bounded-text.js';

export class InviteeName {
  private constructor(readonly value: string) {}

  static create(raw: string): InviteeName {
    return new InviteeName(
      boundedText(raw, 2, 80, 'Le nom de la personne invitée doit compter de 2 à 80 caractères.'),
    );
  }
}
