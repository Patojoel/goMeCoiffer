export const OTP_CODE_GENERATOR = Symbol('OTP_CODE_GENERATOR');
export interface OtpCodeGenerator {
  /** Code aléatoire à 6 chiffres. */
  next(): string;
}
