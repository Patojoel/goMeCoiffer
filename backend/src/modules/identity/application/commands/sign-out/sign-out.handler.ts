import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AUDIT_TRAIL, type AuditTrail, CLOCK, type Clock } from '../../../../../shared/application/ports.js';
import { proofTokenSecret } from '../../../domain/aggregates/phone-proof.js';
import { SECRET_HASHER, type SecretHasher } from '../../../domain/ports/secret-hasher.port.js';
import {
  PHONE_PROOF_REPOSITORY,
  type PhoneProofRepository,
} from '../../../domain/repositories/write/phone-proof.repository.js';
import { SignOut } from './sign-out.command.js';
import type { SignOutResponse } from './sign-out.response.js';

@CommandHandler(SignOut)
export class SignOutHandler implements ICommandHandler<SignOut> {
  constructor(
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(PHONE_PROOF_REPOSITORY) private readonly proofs: PhoneProofRepository,
    @Inject(SECRET_HASHER) private readonly hasher: SecretHasher,
  ) {}

  /** La preuve de numéro d'une tablette partagée ne survit pas à la déconnexion, session ouverte ou non. */
  async execute({ userId, proofToken }: SignOut): Promise<SignOutResponse> {
    if (proofToken !== null) await this.proofs.deleteByTokenHash(this.hasher.hash(proofTokenSecret(proofToken)));
    if (userId === null) return { signedOut: true };
    await this.audit.record({
      action: 'USER_SIGNED_OUT',
      subjectType: 'user',
      subjectId: userId,
      actorUserId: userId,
      occurredAt: this.clock.now(),
    });
    return { signedOut: true };
  }
}
