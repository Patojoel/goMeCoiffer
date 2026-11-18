import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import type { BusinessRuleViolation } from '../../../../shared/domain/errors.js';
import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { OtpPurpose } from '../enums/otp-purpose.enum.js';
import { OtpStatus } from '../enums/otp-status.enum.js';
import { OtpAttemptsExhaustedError } from '../exceptions/otp-attempts-exhausted.error.js';
import { OtpExpiredError } from '../exceptions/otp-expired.error.js';
import { OtpIncorrectError } from '../exceptions/otp-incorrect.error.js';
import { OtpNoLongerValidError } from '../exceptions/otp-no-longer-valid.error.js';
import type { SecretVerifier } from '../ports/secret-verifier.port.js';

export const OTP_LIFETIME_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;

export type OtpVerification = { accepted: true } | { accepted: false; refusal: BusinessRuleViolation };

interface OtpChallengeState {
  id: string;
  phone: string;
  purpose: OtpPurpose;
  codeHash: string;
  status: OtpStatus;
  sentAt: Date;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  version: number;
}

/**
 * Défi SMS : prouve que l'utilisateur possède un numéro. Valable 5 minutes, 5 essais, usage unique ;
 * un défi plus récent pour le même numéro et le même motif le remplace.
 */
export class OtpChallenge extends AggregateRoot {
  private constructor(private state: OtpChallengeState) {
    super();
  }

  static issue(input: { id: string; phone: PhoneNumber; purpose: OtpPurpose; codeHash: string; now: Date }) {
    return new OtpChallenge({
      id: input.id,
      phone: input.phone.value,
      purpose: input.purpose,
      codeHash: input.codeHash,
      status: OtpStatus.ACTIVE,
      sentAt: input.now,
      expiresAt: new Date(input.now.getTime() + OTP_LIFETIME_SECONDS * 1000),
      attempts: 0,
      consumedAt: null,
      version: 0,
    });
  }

  static restore(state: Readonly<OtpChallengeState>) {
    return new OtpChallenge({ ...state });
  }

  get id(): string {
    return this.state.id;
  }

  get phone(): PhoneNumber {
    return PhoneNumber.parse(this.state.phone);
  }

  /** L'essai est compté avant la comparaison : un essai raté doit être sauvegardé, même si la commande refuse. */
  verify(candidate: string, now: Date, verifier: SecretVerifier): OtpVerification {
    if (this.state.status !== OtpStatus.ACTIVE) return refused(new OtpNoLongerValidError());
    if (now.getTime() >= this.state.expiresAt.getTime()) return refused(new OtpExpiredError());
    if (this.state.attempts >= OTP_MAX_ATTEMPTS) return refused(new OtpAttemptsExhaustedError());

    this.state.attempts += 1;
    if (!verifier.matches(candidate, this.state.codeHash)) {
      const left = OTP_MAX_ATTEMPTS - this.state.attempts;
      return refused(left > 0 ? new OtpIncorrectError(left) : new OtpAttemptsExhaustedError());
    }
    this.state.status = OtpStatus.CONSUMED;
    this.state.consumedAt = now;
    return { accepted: true };
  }

  /** Codes faux saisis : l'essai qui a consommé le code n'en est pas un. */
  get failedAttempts(): number {
    return this.state.status === OtpStatus.CONSUMED ? this.state.attempts - 1 : this.state.attempts;
  }

  supersede(): void {
    if (this.state.status === OtpStatus.ACTIVE) this.state.status = OtpStatus.SUPERSEDED;
  }

  snapshot(): Readonly<OtpChallengeState> {
    return { ...this.state };
  }
}

const refused = (refusal: BusinessRuleViolation): OtpVerification => ({ accepted: false, refusal });
