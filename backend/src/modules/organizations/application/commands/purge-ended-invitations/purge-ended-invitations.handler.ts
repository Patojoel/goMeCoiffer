import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { CLOCK, type Clock } from '../../../../../shared/application/ports.js';
import {
  INVITATION_REPOSITORY,
  type InvitationRepository,
} from '../../../domain/repositories/write/invitation.repository.js';
import { ENDED_INVITATION_RETENTION_DAYS } from '../../../domain/services/invitation-admission.js';
import { PurgeEndedInvitations } from './purge-ended-invitations.command.js';
import type { PurgeEndedInvitationsResponse } from './purge-ended-invitations.response.js';

const DAY_MS = 86_400_000;

@CommandHandler(PurgeEndedInvitations)
export class PurgeEndedInvitationsHandler implements ICommandHandler<PurgeEndedInvitations> {
  constructor(
    @Inject(INVITATION_REPOSITORY) private readonly invitations: InvitationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<PurgeEndedInvitationsResponse> {
    const before = new Date(this.clock.now().getTime() - ENDED_INVITATION_RETENTION_DAYS * DAY_MS);
    return { purged: await this.invitations.purgePersonalDataEndedBefore(before) };
  }
}
