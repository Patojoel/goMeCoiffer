import { DomainError } from '../../../shared/domain/errors.js';
import type { PhoneNumber } from '../../../shared/domain/phone-number.js';
import type { NewPassword } from './new-password.js';
import type { OtpChallenge, OtpPurpose, SecretVerifier } from './otp-challenge.js';
import type { User } from './user.js';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export interface UserRepository {
  findByPhone(phone: PhoneNumber): Promise<User | null>;
  save(user: User): Promise<void>;
}

export const OTP_CHALLENGE_REPOSITORY = Symbol('OTP_CHALLENGE_REPOSITORY');
export interface OtpChallengeRepository {
  findActive(phone: PhoneNumber, purpose: OtpPurpose): Promise<OtpChallenge | null>;
  /** Heures d'envoi des défis de ce numéro (tous motifs) depuis `since`. */
  sendTimesSince(phone: PhoneNumber, since: Date): Promise<readonly Date[]>;
  save(challenge: OtpChallenge): Promise<void>;
}

export const SECRET_HASHER = Symbol('SECRET_HASHER');
export interface SecretHasher extends SecretVerifier {
  hash(secret: string): string;
}

export const OTP_CODE_GENERATOR = Symbol('OTP_CODE_GENERATOR');
export interface OtpCodeGenerator {
  /** Code aléatoire à 6 chiffres. */
  next(): string;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export interface PasswordHasher {
  hash(password: NewPassword): Promise<string>;
}

export const COMMON_PASSWORDS = Symbol('COMMON_PASSWORDS');

export const SMS_SENDER = Symbol('SMS_SENDER');
export interface SmsSender {
  /** Lève SmsDeliveryFailedError si le fournisseur refuse ou ne répond pas. */
  send(to: PhoneNumber, text: string): Promise<void>;
}

export class SmsDeliveryFailedError extends DomainError {
  readonly code = 'SMS_UNAVAILABLE';
  constructor() {
    super("L'envoi du SMS est impossible pour le moment. Réessayez dans quelques minutes.");
  }
}
