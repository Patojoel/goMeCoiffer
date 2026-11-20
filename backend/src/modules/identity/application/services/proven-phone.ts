import { PhoneNumber } from '../../../../shared/domain/phone-number.js';
import type { ProvenPhone as ProvenPhonePort } from '../../../organizations/domain/ports/phone-proofs.port.js';
import type { PhoneProof } from '../../domain/aggregates/phone-proof.js';
import { OtpPurpose } from '../../domain/enums/otp-purpose.enum.js';

/**
 * Un numéro qu'une preuve valable atteste. Le constructeur est privé : la seule fabrique est `fromProof`, et
 * `InviteeAccountProvider` vérifie `instanceof` à l'exécution (un objet forgé n'en est pas une instance).
 */
export class ProvenPhone implements ProvenPhonePort {
  private constructor(
    readonly phone: PhoneNumber,
    readonly provenAt: Date,
  ) {}

  static fromProof(proof: PhoneProof, now: Date): ProvenPhone | null {
    if (!proof.isValidFor(OtpPurpose.INVITATION, now)) return null;
    const { phone, provenAt } = proof.snapshot();
    return new ProvenPhone(PhoneNumber.parse(phone), provenAt);
  }
}
