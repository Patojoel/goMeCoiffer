import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../../../shared/application/ports.js';
import {
  PHONE_PROOF_REPOSITORY,
  type PhoneProofRepository,
} from '../../../domain/repositories/write/phone-proof.repository.js';
import { PurgePhoneProofs } from './purge-phone-proofs.command.js';
import type { PurgePhoneProofsResponse } from './purge-phone-proofs.response.js';

@CommandHandler(PurgePhoneProofs)
export class PurgePhoneProofsHandler implements ICommandHandler<PurgePhoneProofs> {
  constructor(
    @Inject(PHONE_PROOF_REPOSITORY) private readonly proofs: PhoneProofRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<PurgePhoneProofsResponse> {
    return { purged: await this.proofs.purgeExpiredAt(this.clock.now()) };
  }
}
