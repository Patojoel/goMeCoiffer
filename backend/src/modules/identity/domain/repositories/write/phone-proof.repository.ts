import type { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import type { PhoneProof } from '../../aggregates/phone-proof.js';

export const PHONE_PROOF_REPOSITORY = Symbol('PHONE_PROOF_REPOSITORY');
export interface PhoneProofRepository {
  add(proof: PhoneProof): Promise<void>;
  /** Cherche par empreinte du jeton : le jeton lui-même n'est jamais stocké. */
  findByTokenHash(tokenHash: string): Promise<PhoneProof | null>;
  /** Oublie la preuve portée par un navigateur (déconnexion). */
  deleteByTokenHash(tokenHash: string): Promise<void>;
  /** Oublie toutes les preuves de ce numéro. */
  deleteOfPhone(phone: PhoneNumber): Promise<void>;
  /** Oublie les preuves échues à `now` ; renvoie leur nombre. Rejouable. */
  purgeExpiredAt(now: Date): Promise<number>;
}
