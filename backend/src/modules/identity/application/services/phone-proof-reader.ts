import { Inject, Injectable } from '@nestjs/common';
import type {
  PhoneProofs,
  ProvenPhone as ProvenPhonePort,
} from '../../../organizations/domain/ports/phone-proofs.port.js';
import { proofTokenSecret } from '../../domain/aggregates/phone-proof.js';
import { SECRET_HASHER, type SecretHasher } from '../../domain/ports/secret-hasher.port.js';
import {
  PHONE_PROOF_REPOSITORY,
  type PhoneProofRepository,
} from '../../domain/repositories/write/phone-proof.repository.js';
import { ProvenPhone } from './proven-phone.js';

/** Le numéro qu'un navigateur a prouvé pour rejoindre un salon, retrouvé par l'empreinte de son jeton. */
@Injectable()
export class PhoneProofReader implements PhoneProofs {
  constructor(
    @Inject(PHONE_PROOF_REPOSITORY) private readonly proofs: PhoneProofRepository,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
  ) {}

  async phoneProvenBy(token: string | null, now: Date): Promise<ProvenPhone | null> {
    if (token === null) return null;
    const proof = await this.proofs.findByTokenHash(this.hasher.hash(proofTokenSecret(token)));
    return proof ? ProvenPhone.fromProof(proof, now) : null;
  }

  forgetProofsOf(proven: ProvenPhonePort): Promise<void> {
    return this.proofs.deleteOfPhone(proven.phone);
  }
}
