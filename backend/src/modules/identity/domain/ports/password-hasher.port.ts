import type { NewPassword } from '../value-objects/new-password.js';

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export interface PasswordHasher {
  hash(password: NewPassword): Promise<string>;
}
