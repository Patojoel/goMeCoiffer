import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  CLOCK,
  type Clock,
  ID_GENERATOR,
  type IdGenerator,
} from '../../../../../shared/application/ports.js';
import { RefuseAfterCommit } from '../../../../../shared/application/refuse-after-commit.js';
import { PhoneNumber } from '../../../../../shared/domain/phone-number.js';
import { PhoneProof, proofTokenSecret } from '../../../domain/aggregates/phone-proof.js';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum.js';
import { OtpNoLongerValidError } from '../../../domain/exceptions/otp-no-longer-valid.error.js';
import {
  PHONE_PROOF_TOKEN_GENERATOR,
  type ProofTokenGenerator,
} from '../../../domain/ports/proof-token-generator.port.js';
import { SECRET_HASHER, type SecretHasher } from '../../../domain/ports/secret-hasher.port.js';
import {
  OTP_CHALLENGE_REPOSITORY,
  type OtpChallengeRepository,
} from '../../../domain/repositories/write/otp-challenge.repository.js';
import {
  PHONE_PROOF_REPOSITORY,
  type PhoneProofRepository,
} from '../../../domain/repositories/write/phone-proof.repository.js';
import { ProveInvitationPhone } from './prove-invitation-phone.command.js';
import type { ProveInvitationPhoneResponse } from './prove-invitation-phone.response.js';

@CommandHandler(ProveInvitationPhone)
export class ProveInvitationPhoneHandler implements ICommandHandler<ProveInvitationPhone> {
  constructor(
    @Inject(OTP_CHALLENGE_REPOSITORY) private readonly challenges: OtpChallengeRepository,
    @Inject(PHONE_PROOF_REPOSITORY) private readonly proofs: PhoneProofRepository,
    @Inject(PHONE_PROOF_TOKEN_GENERATOR) private readonly tokens: ProofTokenGenerator,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
  ) {}

  /** Les demandes et les vérifications d'un même numéro passent une à une (même verrou que la demande de code). */
  async execute(cmd: ProveInvitationPhone): Promise<ProveInvitationPhoneResponse> {
    const phone = PhoneNumber.parse(cmd.phone);
    await this.challenges.lockSendingFor(phone);
    const now = this.clock.now();

    const challenge = await this.challenges.findActive(phone, OtpPurpose.INVITATION);
    if (!challenge) throw new RefuseAfterCommit(new OtpNoLongerValidError());
    const verification = challenge.verify(cmd.code, now, this.hasher);
    await this.challenges.save(challenge);
    if (!verification.accepted) throw new RefuseAfterCommit(verification.refusal);

    const token = this.tokens.next();
    const proof = PhoneProof.issue({
      id: this.ids.next(),
      phone,
      purpose: OtpPurpose.INVITATION,
      tokenHash: this.hasher.hash(proofTokenSecret(token)),
      now,
    });
    await this.proofs.add(proof);
    return { token, provenUntil: proof.snapshot().expiresAt.toISOString() };
  }
}
