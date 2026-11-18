import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../../../shared/application/ports.js';
import {
  SIGN_IN_ATTEMPT_REPOSITORY,
  type SignInAttemptRepository,
} from '../../../domain/repositories/write/sign-in-attempt.repository.js';
import { PurgeSignInAttempts } from './purge-sign-in-attempts.command.js';
import type { PurgeSignInAttemptsResponse } from './purge-sign-in-attempts.response.js';

export const SIGN_IN_HISTORY_RETENTION_MS = 48 * 3_600_000;

@CommandHandler(PurgeSignInAttempts)
export class PurgeSignInAttemptsHandler implements ICommandHandler<PurgeSignInAttempts> {
  constructor(
    @Inject(SIGN_IN_ATTEMPT_REPOSITORY) private readonly attempts: SignInAttemptRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<PurgeSignInAttemptsResponse> {
    const before = new Date(this.clock.now().getTime() - SIGN_IN_HISTORY_RETENTION_MS);
    return { purged: await this.attempts.purgeBefore(before) };
  }
}
