import { InvalidValueError } from '../../../../shared/domain/errors.js';

// oxlint-disable-next-line no-control-regex
const UNSAFE_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Caractères de contrôle, d'inversion de sens et invisibles retirés, espaces normalisés, puis longueur contrôlée. */
export function boundedText(raw: string, min: number, max: number, message: string): string {
  const text = raw.replace(UNSAFE_CHARS, '').trim().replace(/\s+/g, ' ');
  if (text.length < min || text.length > max) throw new InvalidValueError(message);
  return text;
}
