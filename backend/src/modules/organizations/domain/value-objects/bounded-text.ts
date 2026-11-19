import { InvalidValueError } from '../../../../shared/domain/errors.js';

/** Espaces de début, de fin et en double retirés, puis longueur contrôlée. */
export function boundedText(raw: string, min: number, max: number, message: string): string {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length < min || text.length > max) throw new InvalidValueError(message);
  return text;
}
