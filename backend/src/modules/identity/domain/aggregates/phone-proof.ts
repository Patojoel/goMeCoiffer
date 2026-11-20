import { AggregateRoot } from '../../../../shared/domain/aggregate-root.js';
import type { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { OtpPurpose } from '../enums/otp-purpose.enum.js';

export const PHONE_PROOF_LIFETIME_MINUTES = 15;

/** Séparation de domaine : l'empreinte d'un jeton de preuve n'est jamais celle d'un code SMS, même avec le même poivre. */
export const proofTokenSecret = (token: string): string => `phone-proof:${token}`;

interface PhoneProofState {
  id: string;
  phone: string;
  purpose: OtpPurpose;
  /** Empreinte du jeton remis au navigateur : le jeton n'est jamais stocké. */
  tokenHash: string;
  provenAt: Date;
  expiresAt: Date;
}

/**
 * Preuve qu'un navigateur contrôle un numéro, délivrée en échange du bon code SMS. Elle n'ouvre aucune session :
 * elle ne vaut que pour le motif qui l'a fait naître, jusqu'à son échéance.
 */
export class PhoneProof extends AggregateRoot {
  private constructor(private readonly state: PhoneProofState) {
    super();
  }

  static issue(input: {
    id: string;
    phone: PhoneNumber;
    purpose: OtpPurpose;
    tokenHash: string;
    now: Date;
  }): PhoneProof {
    return new PhoneProof({
      id: input.id,
      phone: input.phone.value,
      purpose: input.purpose,
      tokenHash: input.tokenHash,
      provenAt: input.now,
      expiresAt: new Date(input.now.getTime() + PHONE_PROOF_LIFETIME_MINUTES * 60_000),
    });
  }

  static restore(state: Readonly<PhoneProofState>): PhoneProof {
    return new PhoneProof({ ...state });
  }

  isValidFor(purpose: OtpPurpose, now: Date): boolean {
    return this.state.purpose === purpose && now < this.state.expiresAt;
  }

  snapshot(): Readonly<PhoneProofState> {
    return { ...this.state };
  }
}
