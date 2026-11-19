import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AUDIT_TRAIL, type AuditTrail, CLOCK, type Clock } from '../../../../../shared/application/ports.js';
import { SignOut } from './sign-out.command.js';
import type { SignOutResponse } from './sign-out.response.js';

@CommandHandler(SignOut)
export class SignOutHandler implements ICommandHandler<SignOut> {
  constructor(
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute({ userId }: SignOut): Promise<SignOutResponse> {
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
